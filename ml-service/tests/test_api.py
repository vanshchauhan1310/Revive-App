from types import SimpleNamespace

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.hf import HFClient
from app.main import create_app

CATS = [{"slug": "baked_goods", "kind": "food", "label": "Baked goods"},
        {"slug": "furniture", "kind": "non_food", "label": "Furniture"}]


class FakeInference:
    """Stands in for huggingface_hub.InferenceClient."""

    def __init__(self, chat_reply='{"title": "Bread", "category": "baked_goods"}', fail_chat=False):
        self.chat_reply, self.fail_chat, self.calls = chat_reply, fail_chat, []

    def chat_completion(self, messages, **kw):
        self.calls.append(("chat", kw["model"]))
        if self.fail_chat:
            raise RuntimeError("Bad request: model not supported")
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=self.chat_reply))])

    def image_to_text(self, image, model):
        return SimpleNamespace(generated_text="a wooden chair in a room")

    def zero_shot_image_classification(self, image, candidate_labels, model):
        return [SimpleNamespace(label=l, score=0.9 if "furniture" in l else 0.01) for l in candidate_labels]

    def zero_shot_classification(self, text, labels, model):
        return [SimpleNamespace(label="Furniture", score=0.8), SimpleNamespace(label="Baked goods", score=0.2)]

    def text_classification(self, text, model, top_k):
        score = 0.97 if "idiot" in text else 0.01
        return [SimpleNamespace(label="toxic", score=score), SimpleNamespace(label="insult", score=score / 2)]

    def image_classification(self, image, model):
        return [SimpleNamespace(label="normal", score=0.99), SimpleNamespace(label="nsfw", score=0.01)]

    def feature_extraction(self, texts, model):
        rng = np.random.default_rng(len(texts))
        return rng.normal(size=(len(texts), 384))


class FakeLocal:
    """Stands in for app.local_models.LocalModels (no weights downloaded in tests)."""
    device = "cpu"

    def __init__(self):
        self.calls = []

    def load_image(self, url):
        return url

    def caption(self, image):
        self.calls.append("caption")
        return "arafed a loaf of bread on a wooden table"

    def zero_shot_image(self, image, prompts):
        self.calls.append("clip")
        return [0.8 if "bread" in p else 0.2 / max(len(prompts) - 1, 1) for p in prompts]

    def classify_text(self, text, model):
        self.calls.append("toxicity")
        return [("toxic", 0.95 if "idiot" in text else 0.02)]


def make_client(tmp_path, token="secret", local=None, **fake_kw):
    settings = Settings(ml_service_token=token, model_dir=tmp_path, hf_max_retries=0, hf_api_token="hf_test")
    fake = FakeInference(**fake_kw)
    return TestClient(create_app(settings, HFClient(settings, client=fake, local=local))), fake


AUTH = {"authorization": "Bearer secret"}


def test_requires_service_token(tmp_path):
    client, _ = make_client(tmp_path)
    assert client.post("/v1/impact", json={"items": [{"id": "x"}]}).status_code == 401
    assert client.post("/v1/impact", json={"items": [{"id": "x"}]}, headers={"authorization": "Bearer nope"}).status_code == 401
    assert client.get("/health").status_code == 200


def test_listing_suggest_uses_vision_model(tmp_path):
    client, fake = make_client(tmp_path)
    r = client.post("/v1/listing/suggest", headers=AUTH, json={"image_url": "https://x/p.jpg", "categories": CATS})
    assert r.status_code == 200
    body = r.json()
    assert body["suggestion"]["category"] == "baked_goods"
    assert body["suggestion"]["kind"] == "food"
    assert body["meta"]["fallback"] is False
    assert body["meta"]["prompt_version"] == "listing_suggest.v1"


def test_listing_suggest_falls_back_to_open_models_when_vlm_fails(tmp_path):
    client, _ = make_client(tmp_path, fail_chat=True)
    r = client.post("/v1/listing/suggest", headers=AUTH, json={"image_url": "https://x/p.jpg", "categories": CATS})
    body = r.json()
    assert body["meta"]["fallback"] is True
    assert body["suggestion"]["category"] == "furniture"
    assert body["suggestion"]["condition"] == "good"
    assert body["suggestion"]["title"] == "Wooden chair"
    assert "(hosted)" in body["meta"]["model"]


def test_moderation_scores(tmp_path):
    client, _ = make_client(tmp_path)
    r = client.post("/v1/moderate/text", headers=AUTH, json={"texts": ["hello neighbour", "you idiot"]}).json()
    assert r["results"][0]["score"] < 0.1
    assert r["results"][1]["label"] == "toxic" and r["results"][1]["score"] > 0.9


def test_embeddings_are_normalised_and_sized(tmp_path):
    client, _ = make_client(tmp_path)
    r = client.post("/v1/embed", headers=AUTH, json={"texts": ["bread", "chair"]}).json()
    vecs = np.array(r["vectors"])
    assert vecs.shape == (2, 384)
    assert np.allclose(np.linalg.norm(vecs, axis=1), 1, atol=1e-4)


def test_rank_without_model_uses_heuristic(tmp_path):
    client, _ = make_client(tmp_path)
    cands = [{"listing_id": "old", "age_hours": 300, "distance_km": 30},
             {"listing_id": "new", "age_hours": 1, "distance_km": 1, "has_image": True, "exchange_mode": "free"}]
    r = client.post("/v1/rank", headers=AUTH, json={"candidates": cands}).json()
    assert [s["listing_id"] for s in r["scores"]] == ["new", "old"]
    assert r["meta"]["model"] == "heuristic"


def test_impact(tmp_path):
    client, _ = make_client(tmp_path)
    r = client.post("/v1/impact", headers=AUTH, json={"items": [{"id": "o1", "kind": "food", "category": "cooked_meal"}]}).json()
    assert r["results"][0]["kg_co2e"] == pytest.approx(1.25)
    assert r["meta"]["model_version"] == "impact_factors.v1"


def test_metrics_endpoint(tmp_path):
    client, _ = make_client(tmp_path)
    client.post("/v1/impact", headers=AUTH, json={"items": [{"id": "o1"}]})
    assert "ml_requests_total" in client.get("/metrics").text


class BrokeInference(FakeInference):
    """Hosted API that is out of credits for every task."""

    def _402(self, *a, **k):
        raise RuntimeError("402 Payment Required: You have no remaining credits")

    chat_completion = image_to_text = zero_shot_classification = text_classification = _402
    image_classification = feature_extraction = zero_shot_image_classification = _402


def test_out_of_credits_falls_back_to_free_local_models(tmp_path):
    settings = Settings(ml_service_token="secret", model_dir=tmp_path, hf_max_retries=0, hf_api_token="hf_test")
    local = FakeLocal()
    hf = HFClient(settings, client=BrokeInference(), local=local)
    client = TestClient(create_app(settings, hf))
    r = client.post("/v1/listing/suggest", headers=AUTH, json={"image_url": "https://x/p.jpg", "categories": CATS}).json()
    s = r["suggestion"]
    assert s["category"] == "baked_goods" and s["kind"] == "food"
    assert s["title"] == "Loaf of bread"            # BLIP artefacts and trailing location removed
    assert s["allergens"] == ["gluten"]
    assert s["shelf_life_hours"] == 48
    assert "(local)" in r["meta"]["model"]
    assert not hf.api_available()                   # hosted API paused after the 402
    m = client.post("/v1/moderate/text", headers=AUTH, json={"texts": ["you idiot"]}).json()
    assert m["results"][0]["score"] > 0.9 and m["meta"]["backend"] == "local"


def test_local_mode_never_calls_hosted_api(tmp_path):
    settings = Settings(ml_service_token="secret", model_dir=tmp_path, hf_mode="local", hf_api_token="hf_test")
    fake = FakeInference()
    hf = HFClient(settings, client=fake, local=FakeLocal())
    TestClient(create_app(settings, hf)).post("/v1/listing/suggest", headers=AUTH, json={"image_url": "https://x/p.jpg", "categories": CATS})
    assert fake.calls == []


def test_clean_caption():
    from app.suggest import clean_caption
    assert clean_caption("arafed a red bicycle leaning against a wall") == ("Red bicycle leaning", "A red bicycle leaning against a wall.")
    assert clean_caption("a photo of a stack of books on a table")[0] == "Stack of books"
    assert clean_caption("a photo of a croissant being sprinkled with powder")[0] == "Croissant"
    assert clean_caption("a photo of a bunch of breads sitting on a table")[0] == "Breads"
    assert clean_caption("a photo of a white bowl filled with pasta and sauce")[0] == "White bowl of pasta and sauce"
