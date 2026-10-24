"""Train the "For you" ranker, track it in MLflow and register it as a challenger.

    python -m pipelines.train_ranker --synthetic
    python -m pipelines.train_ranker --data data/features/ranker-<ts>.parquet
"""
from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

from app.features import RANKER_FEATURES, ranker_matrix
from app.ranking import heuristic_score

from .common import RANKER_NAME, frame_hash, latest_snapshot, mlflow_setup, ndcg_at_k, synthetic_ranker, time_split


def load(args) -> tuple[pd.DataFrame, str]:
    if args.synthetic:
        return synthetic_ranker(), "synthetic"
    path = Path(args.data) if args.data else latest_snapshot("ranker")
    if not path or not path.exists():
        raise SystemExit("No ranker snapshot. Run `python -m pipelines.build_features` or pass --synthetic.")
    return pd.read_parquet(path), path.name


def evaluate(model, df: pd.DataFrame) -> dict:
    df = df.copy()
    df["model_score"] = model.predict_proba(ranker_matrix(df.to_dict("records")))[:, 1]
    df["heuristic_score"] = [heuristic_score(r) for r in df.to_dict("records")]
    return {
        "ndcg_at_10": ndcg_at_k(df, "model_score", 10),
        "ndcg_at_5": ndcg_at_k(df, "model_score", 5),
        "auc": float(roc_auc_score(df["label"], df["model_score"])) if df["label"].nunique() > 1 else 0.5,
        "baseline_ndcg_at_10": ndcg_at_k(df, "heuristic_score", 10),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--data")
    ap.add_argument("--min-rows", type=int, default=500)
    ap.add_argument("--learning-rate", type=float, default=0.06)
    ap.add_argument("--max-iter", type=int, default=250)
    args = ap.parse_args(argv)

    df, source = load(args)
    if len(df) < args.min_rows or df["label"].nunique() < 2:
        raise SystemExit(f"Not enough training data ({len(df)} rows). The heuristic ranker stays in production.")
    train, test = time_split(df, group="session")
    params = {"learning_rate": args.learning_rate, "max_iter": args.max_iter, "max_leaf_nodes": 31,
              "l2_regularization": 1.0, "early_stopping": True, "random_state": 0}
    model = HistGradientBoostingClassifier(**params)
    model.fit(ranker_matrix(train.to_dict("records")), train["label"].to_numpy())
    metrics = evaluate(model, test)

    mlflow = mlflow_setup("ecoshare-ranker")
    import mlflow.sklearn  # noqa: F401

    with mlflow.start_run() as run:
        mlflow.log_params({**params, "features": ",".join(RANKER_FEATURES), "source": source})
        mlflow.set_tags({"data_hash": frame_hash(df), "train_rows": len(train), "test_rows": len(test)})
        mlflow.log_metrics(metrics)
        with tempfile.TemporaryDirectory() as tmp:
            holdout = Path(tmp) / "holdout.parquet"
            test.to_parquet(holdout, index=False)
            mlflow.log_artifact(str(holdout))
        # We build this model ourselves; TreePredictor is the only skops type that needs trusting.
        info = mlflow.sklearn.log_model(model, name="model", registered_model_name=RANKER_NAME,
                                        skops_trusted_types=["sklearn.ensemble._hist_gradient_boosting.predictor.TreePredictor"])
        version = info.registered_model_version
        mlflow.MlflowClient().set_registered_model_alias(RANKER_NAME, "challenger", version)
    print(f"ranker v{version} run={run.info.run_id} " + " ".join(f"{k}={v:.4f}" for k, v in metrics.items()))
    return version, metrics


if __name__ == "__main__":
    main()
