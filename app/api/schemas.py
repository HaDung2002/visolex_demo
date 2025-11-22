from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Literal, Sequence

from flask import current_app

from app.utils.error_handling import TextProcessingError


def _validate_text(value: str, field_name: str) -> str:
    if not isinstance(value, str):
        raise TextProcessingError(f"{field_name} must be a string")

    text = value.strip()
    if not text:
        raise TextProcessingError(f"{field_name} cannot be empty")

    max_len = current_app.config["MAX_TEXT_LENGTH"]
    if len(text) > max_len:
        raise TextProcessingError(
            f"{field_name} exceeds maximum length of {max_len} characters"
        )
    return text


@dataclass
class NormalizeRequest:
    text: str
    device: Literal["cpu", "cuda"] = "cpu"

    @classmethod
    def from_dict(cls, payload: dict) -> "NormalizeRequest":
        if "text" not in payload:
            raise TextProcessingError("Field 'text' is required")

        text = _validate_text(payload["text"], "text")
        device = payload.get("device", current_app.config["DEVICE"])

        return cls(text=text, device=device)


@dataclass
class DetectNSWRequest(NormalizeRequest):
    pass


@dataclass
class BatchProcessRequest:
    texts: Sequence[str]
    mode: Literal["normalize", "detect-nsw"] = "normalize"
    device: Literal["cpu", "cuda"] = "cpu"

    @classmethod
    def from_dict(cls, payload: dict) -> "BatchProcessRequest":
        if "texts" not in payload:
            raise TextProcessingError("Field 'texts' is required")

        texts_raw = payload["texts"]
        if not isinstance(texts_raw, list) or not texts_raw:
            raise TextProcessingError("'texts' must be a non-empty list of strings")

        max_batch = current_app.config["MAX_BATCH_SIZE"]
        if len(texts_raw) > max_batch:
            raise TextProcessingError(
                f"Batch size exceeds limit of {max_batch} entries"
            )

        texts: List[str] = [
            _validate_text(text, f"text[{idx}]") for idx, text in enumerate(texts_raw)
        ]

        mode = payload.get("mode", "normalize")
        if mode not in {"normalize", "detect-nsw"}:
            raise TextProcessingError("mode must be 'normalize' or 'detect-nsw'")

        device = payload.get("device", current_app.config["DEVICE"])

        return cls(texts=texts, mode=mode, device=device)

