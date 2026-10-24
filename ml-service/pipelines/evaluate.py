"""Promotion gate: champion vs challenger on the challenger's out-of-time holdout.

The challenger becomes `production` only if it beats both the current champion and the
non-ML baseline by a margin. The promoted model is exported to models/production/ for
the API to load (no MLflow dependency at serving time).

    python -m pipelines.evaluate ranker
    python -m pipelines.evaluate risk --force   # skip the gate (manual override, logged)
"""
from __future__ import annotations

import argparse
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd

from app.features import RANKER_FEATURES, RISK_FEATURES

from . import train_ranker, train_risk
from .common import MODEL_DIR, RANKER_NAME, RISK_NAME, mlflow_setup, write_json

SPECS = {
    "ranker": {"registered": RANKER_NAME, "metric": "ndcg_at_10", "baseline": "baseline_ndcg_at_10",
               "higher_is_better": True, "min_gain": 0.005, "features": RANKER_FEATURES, "evaluate": train_ranker.evaluate},
    "risk": {"registered": RISK_NAME, "metric": "auc", "baseline": "baseline_auc",
             "higher_is_better": True, "min_gain": 0.005, "features": RISK_FEATURES, "evaluate": train_risk.evaluate},
}


def decide(challenger: dict, champion: dict | None, spec: dict) -> tuple[bool, str]:
    """Pure gate logic (unit-tested)."""
    m, gain = spec["metric"], spec["min_gain"]
    if challenger[m] < challenger[spec["baseline"]] + gain:
        return False, f"{m}={challenger[m]:.4f} does not beat baseline {challenger[spec['baseline']]:.4f} by {gain}"
    if champion is not None and challenger[m] < champion[m] + gain:
        return False, f"{m}={challenger[m]:.4f} does not beat champion {champion[m]:.4f} by {gain}"
    return True, f"{m}={challenger[m]:.4f} passes (champion={champion[m] if champion else 'none'})"


def export(model, name: str, version: str, run_id: str, metrics: dict, features: list[str]):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_DIR / f"{name}.joblib")
    write_json(MODEL_DIR / f"{name}.json", {
        "name": name, "version": str(version), "run_id": run_id, "metrics": metrics, "features": features,
        "promoted_at": datetime.now(timezone.utc).isoformat(),
    })


def notify_service():
    url, token = os.environ.get("ML_SERVICE_URL"), os.environ.get("ML_SERVICE_TOKEN")
    if not url:
        return
    import httpx

    try:
        httpx.post(f"{url}/admin/reload", headers={"authorization": f"Bearer {token}"} if token else {}, timeout=10)
    except httpx.HTTPError as err:
        print(f"warning: could not reload ml-service: {err}")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("model", choices=SPECS)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args(argv)
    spec = SPECS[args.model]
    mlflow = mlflow_setup(f"ecoshare-{args.model}")
    import mlflow.sklearn  # noqa: F401

    client = mlflow.MlflowClient()
    try:
        chal_v = client.get_model_version_by_alias(spec["registered"], "challenger")
    except mlflow.exceptions.MlflowException:
        raise SystemExit("No challenger registered. Train first.")
    challenger = mlflow.sklearn.load_model(f"models:/{spec['registered']}@challenger")
    with tempfile.TemporaryDirectory() as tmp:
        holdout = pd.read_parquet(mlflow.artifacts.download_artifacts(run_id=chal_v.run_id, artifact_path="holdout.parquet", dst_path=tmp))

    chal_metrics = spec["evaluate"](challenger, holdout)
    champ_metrics = None
    try:
        champ_v = client.get_model_version_by_alias(spec["registered"], "production")
        if champ_v.version != chal_v.version:
            champion = mlflow.sklearn.load_model(f"models:/{spec['registered']}@production")
            champ_metrics = spec["evaluate"](champion, holdout)
    except mlflow.exceptions.MlflowException:
        pass

    ok, reason = decide(chal_metrics, champ_metrics, spec)
    if args.force and not ok:
        reason = f"FORCED: {reason}"
        ok = True
    client.set_model_version_tag(spec["registered"], chal_v.version, "gate", reason)
    print(f"[{args.model}] challenger v{chal_v.version}: {reason}")
    if not ok:
        return False
    client.set_registered_model_alias(spec["registered"], "production", chal_v.version)
    export(challenger, args.model, chal_v.version, chal_v.run_id, chal_metrics, spec["features"])
    notify_service()
    print(f"[{args.model}] v{chal_v.version} promoted to production and exported to {MODEL_DIR}")
    return True


if __name__ == "__main__":
    raise SystemExit(0 if main() else 1)
