import os
from typing import Any, Callable

MODEL = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"
REVISION = "6f5cf0a2b59cabb106aca4c287eed12e357e90eb"
MANIFEST = "96790beaba6826db1efe51c8638be09b049e71517c7ac8334fe1dca20e991918"
ENTAILMENT_THRESHOLD = 0.85
CONTRADICTION_THRESHOLD = 0.85
AGGREGATE_RULE = "ANY_SUPPORT_ELSE_NOT_SUPPORTED"

def validate_pin(pin: dict[str, Any]) -> None:
    expected = {
        "model": MODEL, "revision": REVISION,
        "engineManifestSha256": MANIFEST,
        "entailmentThreshold": ENTAILMENT_THRESHOLD,
        "contradictionThreshold": CONTRADICTION_THRESHOLD,
        "aggregateRule": AGGREGATE_RULE,
    }
    if pin != expected:
        raise ValueError("PIN_MISMATCH")

def decide(payload: dict[str, Any], scorer: Callable[[str, str], dict[str, float]]) -> dict[str, Any]:
    validate_pin(payload.get("pin") or {})
    claim = payload["claim"]["text"]
    evidence = payload.get("evidence") or []
    if not evidence:
        raise ValueError("EVIDENCE_REQUIRED")
    scores = []
    for item in evidence:
        premise = "\n".join(x for x in [item.get("title"), item.get("abstract")] if x)
        result = scorer(premise, claim)
        scores.append(result)
    support = any(float(x.get("entailment", 0)) >= ENTAILMENT_THRESHOLD for x in scores)
    contradiction = any(float(x.get("contradiction", 0)) >= CONTRADICTION_THRESHOLD for x in scores)
    primary = "SUPPORT" if support else "NOT_SUPPORTED"
    diagnostic = "SUPPORT" if support else ("CONTRADICTS" if contradiction else "NOT_SUPPORTING")
    return {
        "model": MODEL, "revision": REVISION, "engine_manifest_sha256": MANIFEST,
        "primary_decision": primary, "diagnostic": diagnostic
    }

_PIPELINE = None
def _scorer(premise: str, hypothesis: str) -> dict[str, float]:
    global _PIPELINE
    if _PIPELINE is None:
        from transformers import pipeline
        _PIPELINE = pipeline("text-classification", model=MODEL, revision=REVISION, top_k=None)
    rows = _PIPELINE({"text": premise, "text_pair": hypothesis})
    if rows and isinstance(rows[0], list): rows = rows[0]
    out = {}
    for row in rows:
        label = str(row["label"]).lower()
        if "entail" in label: out["entailment"] = float(row["score"])
        elif "contrad" in label: out["contradiction"] = float(row["score"])
        elif "neutral" in label: out["neutral"] = float(row["score"])
    return out

def model_fn(model_dir):
    return True

def input_fn(request_body, content_type):
    import json
    if content_type != "application/json": raise ValueError("CONTENT_TYPE_REQUIRED")
    return json.loads(request_body)

def predict_fn(data, model):
    return decide(data, _scorer)

def output_fn(prediction, accept):
    import json
    return json.dumps(prediction), "application/json"
