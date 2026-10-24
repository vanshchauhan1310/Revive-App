import json

import numpy as np

from app.features import RANKER_FEATURES, ranker_matrix
from app.ranking import Ranker
from pipelines import common, evaluate, train_ranker, train_risk
from pipelines.drift_report import compare, psi


def test_feature_contract_shapes():
    X = ranker_matrix([{"similarity": None, "distance_km": None}, {"similarity": 0.3, "kind": "food"}])
    assert X.shape == (2, len(RANKER_FEATURES))
    assert not np.isnan(X).any()


def test_time_split_keeps_sessions_together():
    df = common.synthetic_ranker(n_users=20, sessions_per_user=3)
    train, test = common.time_split(df, group="session")
    assert set(train.session).isdisjoint(set(test.session))
    assert train.created_at.max() <= test.created_at.min()


def test_ranker_beats_heuristic_on_synthetic(tmp_path, monkeypatch):
    monkeypatch.setenv("MLFLOW_TRACKING_URI", f"sqlite:///{tmp_path / 'mlflow.db'}")
    monkeypatch.chdir(tmp_path)
    version, metrics = train_ranker.main(["--synthetic"])
    assert metrics["ndcg_at_10"] > metrics["baseline_ndcg_at_10"]
    assert metrics["auc"] > 0.65


def test_risk_model_trains(tmp_path, monkeypatch):
    monkeypatch.setenv("MLFLOW_TRACKING_URI", f"sqlite:///{tmp_path / 'mlflow.db'}")
    monkeypatch.chdir(tmp_path)
    _, metrics = train_risk.main(["--synthetic"])
    assert metrics["auc"] > 0.6
    assert 0 < metrics["brier"] < 0.25


def test_promotion_gate_logic():
    spec = evaluate.SPECS["ranker"]
    good = {"ndcg_at_10": 0.62, "baseline_ndcg_at_10": 0.55}
    assert evaluate.decide(good, None, spec)[0]
    assert not evaluate.decide({"ndcg_at_10": 0.552, "baseline_ndcg_at_10": 0.55}, None, spec)[0]
    assert not evaluate.decide(good, {"ndcg_at_10": 0.618}, spec)[0]
    assert evaluate.decide(good, {"ndcg_at_10": 0.60}, spec)[0]


def test_train_promote_serve_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("MLFLOW_TRACKING_URI", f"sqlite:///{tmp_path / 'mlflow.db'}")
    monkeypatch.setattr(evaluate, "MODEL_DIR", tmp_path / "prod")
    monkeypatch.chdir(tmp_path)
    train_ranker.main(["--synthetic"])
    assert evaluate.main(["ranker"]) is True
    manifest = json.loads((tmp_path / "prod" / "ranker.json").read_text())
    assert manifest["features"] == RANKER_FEATURES
    ranker = Ranker(tmp_path / "prod")
    scores, meta = ranker.score([{"similarity": 0.9, "age_hours": 1}, {"similarity": -0.1, "age_hours": 300}])
    assert meta["model"] == "ecoshare-ranker" and meta["model_version"] == manifest["version"]
    assert scores[0] > scores[1]
    # Re-training an identical model must not displace the champion (no gain).
    train_ranker.main(["--synthetic"])
    assert evaluate.main(["ranker"]) is False


def test_ranker_refuses_mismatched_feature_contract(tmp_path):
    import joblib

    joblib.dump(object(), tmp_path / "ranker.joblib")
    (tmp_path / "ranker.json").write_text(json.dumps({"version": "1", "features": ["old_feature"]}))
    assert Ranker(tmp_path).model is None


def test_psi_detects_shift():
    rng = np.random.default_rng(0)
    a = rng.normal(0, 1, 5000)
    assert psi(a, rng.normal(0, 1, 5000)) < 0.05
    assert psi(a, rng.normal(1.5, 1, 5000)) > 0.25
    ref = common.synthetic_ranker(n_users=40, seed=1).to_dict("records")
    same = compare(ref, common.synthetic_ranker(n_users=40, seed=2).to_dict("records"))
    shifted = compare(ref, common.synthetic_ranker(n_users=40, seed=2, shift=0.8).to_dict("records"))
    assert same["status"] == "ok"
    assert shifted["status"] == "alert"
