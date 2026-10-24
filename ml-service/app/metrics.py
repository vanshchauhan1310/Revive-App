from prometheus_client import Counter, Histogram

REQUESTS = Counter("ml_requests_total", "ml-service requests", ["task", "outcome"])
FALLBACKS = Counter("ml_fallbacks_total", "Responses served by a fallback path", ["task"])
LATENCY = Histogram("ml_latency_seconds", "Task latency", ["task"], buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30))
SCORES = Histogram("ml_score", "Distribution of model scores (drift signal)", ["task"],
                   buckets=(0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0))
