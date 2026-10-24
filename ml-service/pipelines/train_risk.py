"""Train the exchange-completion (reliability) model and register it as a challenger.

    python -m pipelines.train_risk --synthetic
"""
from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.features import RISK_FEATURES, risk_matrix

from .common import RISK_NAME, frame_hash, latest_snapshot, mlflow_setup, synthetic_risk, time_split


def prior_score(r) -> float:
    done, failed = float(r.get("prior_completed") or 0), float(r.get("prior_failed") or 0)
    return (done + 4) / (done + failed + 5)


def evaluate(model, df: pd.DataFrame) -> dict:
    p = model.predict_proba(risk_matrix(df.to_dict("records")))[:, 1]
    base = [prior_score(r) for r in df.to_dict("records")]
    y = df["label"].to_numpy()
    return {
        "auc": float(roc_auc_score(y, p)),
        "brier": float(brier_score_loss(y, p)),
        "baseline_auc": float(roc_auc_score(y, base)),
        "positive_rate": float(y.mean()),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--data")
    ap.add_argument("--min-rows", type=int, default=300)
    args = ap.parse_args(argv)

    if args.synthetic:
        df, source = synthetic_risk(), "synthetic"
    else:
        path = Path(args.data) if args.data else latest_snapshot("risk")
        if not path or not path.exists():
            raise SystemExit("No risk snapshot. Run `python -m pipelines.build_features` or pass --synthetic.")
        df, source = pd.read_parquet(path), path.name
    if len(df) < args.min_rows or df["label"].nunique() < 2:
        raise SystemExit(f"Not enough training data ({len(df)} rows). The prior-based score stays in production.")

    train, test = time_split(df)
    model = CalibratedClassifierCV(make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=1000)),
                                   method="isotonic", cv=3)
    model.fit(risk_matrix(train.to_dict("records")), train["label"].to_numpy())
    metrics = evaluate(model, test)

    mlflow = mlflow_setup("ecoshare-risk")
    import mlflow.sklearn  # noqa: F401

    with mlflow.start_run() as run:
        mlflow.log_params({"model": "logreg+isotonic", "C": 1.0, "features": ",".join(RISK_FEATURES), "source": source})
        mlflow.set_tags({"data_hash": frame_hash(df), "train_rows": len(train), "test_rows": len(test)})
        mlflow.log_metrics(metrics)
        with tempfile.TemporaryDirectory() as tmp:
            holdout = Path(tmp) / "holdout.parquet"
            test.to_parquet(holdout, index=False)
            mlflow.log_artifact(str(holdout))
        info = mlflow.sklearn.log_model(model, name="model", registered_model_name=RISK_NAME,
                                        skops_trusted_types=["sklearn.calibration._CalibratedClassifier"])
        version = info.registered_model_version
        mlflow.MlflowClient().set_registered_model_alias(RISK_NAME, "challenger", version)
    print(f"risk v{version} run={run.info.run_id} " + " ".join(f"{k}={v:.4f}" for k, v in metrics.items()))
    return version, metrics


if __name__ == "__main__":
    main()
