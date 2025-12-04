import json
import time
import statistics
from datetime import datetime
from app.config import LOG_FOLDER, MONTHLY_REPORT_FOLDER, CRITICAL_CASES_FILE, THRESHOLD_LOW_CONFIDENCE

#  log files
PREDICTIONS_FILE = f"{LOG_FOLDER}/predictions.jsonl"

#   logging critical cases
def log_critical_case(text, confidence, prediction):
    with open(CRITICAL_CASES_FILE, "a") as f:
        f.write(json.dumps({
            "timestamp": datetime.now().isoformat(),
            "text": text,
            "confidence": confidence,
            "prediction": prediction
        }) + "\n")

#  logging prediction
def log_prediction(text, prediction, confidence, lat_total, lat_inference, lat_server):
    record = {
        "timestamp": datetime.now().isoformat(),
        "text": text,
        "prediction": prediction,
        "confidence": confidence,
        "latency_total": lat_total,
        "latency_inference": lat_inference,
        "latency_server": lat_server
    }
    with open(PREDICTIONS_FILE, "a") as f:
        f.write(json.dumps(record) + "\n")

# Monthly report generation
def generate_monthly_report():
    now = datetime.now()
    month_id = now.strftime("%Y_%m")
    report_path = f"{MONTHLY_REPORT_FOLDER}/report_{month_id}.json"

    #reading logs
    predictions = []
    try:
        with open(PREDICTIONS_FILE, "r") as f:
            for line in f:
                predictions.append(json.loads(line))
    except FileNotFoundError:
        return {"status": "no_data"}

    if not predictions:
        return {"status": "no_data"}

    labels = [p["prediction"] for p in predictions]
    confidences = [p["confidence"] for p in predictions]
    latencies_total = [p["latency_total"] for p in predictions]
    latencies_inference = [p["latency_inference"] for p in predictions]
    latencies_server = [p["latency_server"] for p in predictions]

    fake_count = labels.count("fake")
    real_count = labels.count("real")
    ratio = {"fake": fake_count, "real": real_count, "fake_real_ratio": fake_count / max(real_count,1)}

    avg_latency_total = statistics.mean(latencies_total)
    avg_latency_inference = statistics.mean(latencies_inference)
    avg_latency_server = statistics.mean(latencies_server)
    avg_conf = statistics.mean(confidences)

    #  model drift
    current_month = [p["prediction"] for p in predictions if datetime.fromisoformat(p["timestamp"]).month == now.month]
    prev_month = [p["prediction"] for p in predictions if datetime.fromisoformat(p["timestamp"]).month == (now.month-1 or 12)]
    current_ratio = current_month.count("fake")/max(current_month.count("real"),1) if current_month else 0
    prev_ratio = prev_month.count("fake")/max(prev_month.count("real"),1) if prev_month else 0
    model_drift = current_ratio - prev_ratio

    # error analysis
    error_analysis = {
        "low_confidence_cases": sum(1 for c in confidences if c < THRESHOLD_LOW_CONFIDENCE),
        "high_latency_cases": sum(1 for l in latencies_total if l > 1.2)
    }

    server_health = {"total_predictions": len(labels)}
    anomalies = []
    if fake_count > (1.5*real_count): anomalies.append("Unusual spike in fake news detected!")
    if avg_latency_total > 1.5: anomalies.append("Total latency unusually high.")

    report = {
        "timestamp": now.isoformat(),
        "fake_real_ratio": ratio,
        "average_confidence": avg_conf,
        "average_latency_total": avg_latency_total,
        "average_latency_inference": avg_latency_inference,
        "average_latency_server": avg_latency_server,
        "model_drift": model_drift,
        "error_analysis": error_analysis,
        "server_health": server_health,
        "anomalies": anomalies
    }

    with open(report_path, "w") as f:
        json.dump(report, f, indent=4)

    return report

