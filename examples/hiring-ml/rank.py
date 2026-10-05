import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier


def rank(candidates: pd.DataFrame, model: GradientBoostingClassifier):
    return model.predict_proba(candidates)[:, 1]
