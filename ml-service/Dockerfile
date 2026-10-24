FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MLFLOW_DISABLE_AGENT_HINT=1
WORKDIR /srv
COPY requirements.txt requirements-local.txt ./
# Build with --build-arg LOCAL_MODELS=true to run the open HF models in-container (no credits needed).
ARG LOCAL_MODELS=false
RUN pip install --no-cache-dir -r requirements.txt && if [ "$LOCAL_MODELS" = "true" ]; then pip install --no-cache-dir -r requirements-local.txt; fi
COPY app ./app
RUN mkdir -p models/production && useradd --create-home --uid 10001 ml && chown -R ml /srv
USER ml
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
