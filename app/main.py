from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import time
import json
import nest_asyncio

from app.model_utils import load_model
from app.logging_utils import log_prediction, log_critical_case, generate_monthly_report
from app.config import THRESHOLD_LOW_CONFIDENCE


# Allow nested event loops (VS Code / Jupyter fix)
nest_asyncio.apply()

# Create FastAPI app
app = FastAPI()

# Mount static folder
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve index.html at root
@app.get("/")
def root():
    return FileResponse("static/index.html")


# Load model
model = load_model()


# Request model
class NewsItem(BaseModel):
    text: str


# Predict endpoint
@app.post("/predict")
async def predict(news: NewsItem):
    start_total = time.time()
    start_inference = time.time()

    prediction_raw = model.predict([news.text])[0]
    proba = model.predict_proba([news.text])[0]

    inference_latency = time.time() - start_inference
    confidence = float(max(proba))
    prediction = "fake" if prediction_raw == 0 else "real"
    total_latency = time.time() - start_total
    server_latency = total_latency - inference_latency

    log_prediction(
        news.text, prediction, confidence,
        total_latency, inference_latency, server_latency
    )

    if confidence < THRESHOLD_LOW_CONFIDENCE:
        log_critical_case(news.text, confidence, prediction)

    return {
        "prediction": prediction,
        "confidence": confidence,
        "probabilities": {
            "fake": float(proba[0]),
            "real": float(proba[1])
        }
    }


# Monthly report endpoint
@app.get("/monthly-report")
async def monthly_report():
    report = generate_monthly_report()
    if not report:
        return {"message": "No monthly report yet."}
    return report


# Critical cases endpoint
@app.get("/critical-cases")
async def get_critical_cases():
    cases = []
    decoder = json.JSONDecoder()

    try:
        with open('logs/critical_cases.jsonl', "r") as f:
            for line in f:
                s = line.strip()
                if not s:
                    continue
                try:
                    cases.append(json.loads(s))
                    continue
                except json.JSONDecodeError:
                    pass

                
                idx = 0
                length = len(s)
                while idx < length:
                    try:
                        obj, end = decoder.raw_decode(s, idx)
                        cases.append(obj)
                        idx = end
                    except json.JSONDecodeError:
                        break 
    except FileNotFoundError:
        return {"cases": []}

    if not cases:
        return {"cases": [{"message": "No critical cases yet."}]}

    return {"cases": cases}


# Model info endpoint
@app.get("/model-info")
async def model_info():
    with open('model_metadata_v20251120_2200.json') as f:
        return json.load(f)


# Run server manually (not needed when using `uvicorn app.main:app --reload`)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
