from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """All runtime configuration. Model ids are swappable without code changes."""

    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    # Hugging Face Inference Providers. The token stays inside this service.
    hf_api_token: str | None = None
    hf_provider: str = "auto"
    hf_timeout_s: float = 20.0
    hf_max_retries: int = 2
    # auto: hosted API first, free local models when it fails (e.g. 402 out of credits)
    # api: hosted only · local: never call the hosted API
    hf_mode: str = "auto"
    local_warmup: bool = True

    # Shared secret required from the backend (Authorization: Bearer ...).
    ml_service_token: str | None = None

    vision_model: str = "Qwen/Qwen2.5-VL-7B-Instruct"
    caption_model: str = "Salesforce/blip-image-captioning-large"
    local_caption_model: str = "Salesforce/blip-image-captioning-large"
    clip_model: str = "openai/clip-vit-base-patch32"
    zero_shot_model: str = "facebook/bart-large-mnli"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384
    toxicity_model: str = "unitary/toxic-bert"
    nsfw_image_model: str = "Falconsai/nsfw_image_detection"

    listing_prompt_version: str = "listing_suggest.v1"
    impact_factors_version: str = "impact_factors.v1"

    # Directory holding the promoted production models exported by pipelines/evaluate.py
    model_dir: Path = ROOT / "models" / "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
