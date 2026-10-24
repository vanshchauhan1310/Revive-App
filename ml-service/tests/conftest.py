import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("MLFLOW_DISABLE_AGENT_HINT", "1")
# Tests must not depend on a developer's ml-service/.env.
os.environ["HF_MODE"] = "auto"
os.environ["LOCAL_WARMUP"] = "false"
