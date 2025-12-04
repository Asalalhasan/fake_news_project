import joblib

def load_model(path="models/fake_news_classifier_v20251120_2200.pkl"):
    """Load the pre-trained Naive Bayes model pipeline"""
    return joblib.load(path)
