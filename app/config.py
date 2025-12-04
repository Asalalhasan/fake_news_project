import os

LOG_FOLDER = "logs"
MONTHLY_REPORT_FOLDER = "monthly_reports"
CRITICAL_CASES_FILE = os.path.join(LOG_FOLDER, "critical_cases.jsonl")
THRESHOLD_LOW_CONFIDENCE = 0.55

os.makedirs("static", exist_ok=True)
os.makedirs(LOG_FOLDER, exist_ok=True)
os.makedirs(MONTHLY_REPORT_FOLDER, exist_ok=True)
