PY ?= .venv/bin/python
export MLFLOW_DISABLE_AGENT_HINT=1

.PHONY: install serve test eval eval-live features train promote pipeline pipeline-synthetic drift score mlflow-ui

install:
	uv venv --python 3.11 .venv && VIRTUAL_ENV=.venv uv pip install -r requirements-train.txt

serve:
	$(PY) -m uvicorn app.main:app --reload --port 8000

test:
	$(PY) -m pytest -q

eval:
	$(PY) -m evals.run_evals

eval-live:
	$(PY) -m evals.run_evals --live

features:
	$(PY) -m pipelines.build_features

train:
	$(PY) -m pipelines.train_ranker && $(PY) -m pipelines.train_risk

promote:
	$(PY) -m pipelines.evaluate ranker; $(PY) -m pipelines.evaluate risk

# Full loop on real data: extract -> train -> gate/promote -> refresh reliability scores
pipeline: features train promote score

# Same loop on synthetic data (demo / CI); does not touch the database
pipeline-synthetic:
	$(PY) -m pipelines.train_ranker --synthetic && $(PY) -m pipelines.evaluate ranker
	$(PY) -m pipelines.train_risk --synthetic && $(PY) -m pipelines.evaluate risk

drift:
	$(PY) -m pipelines.drift_report

score:
	$(PY) -m pipelines.score_users

mlflow-ui:
	$(PY) -m mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5001
