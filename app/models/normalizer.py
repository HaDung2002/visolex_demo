from __future__ import annotations

import logging
from typing import List

try:  # pragma: no cover - import guarded for environments without torch
    import torch
except ImportError:  # pragma: no cover
    torch = None

try:  # pragma: no cover - import guarded for environments without HF
    from transformers import AutoModelForMaskedLM, AutoTokenizer  # type: ignore
except Exception:  # pragma: no cover
    AutoModelForMaskedLM = None
    AutoTokenizer = None

from app.utils.error_handling import ModelLoadError, TextProcessingError
from app.utils.text_processing import (
    MOCK_REPLACEMENTS,
    generate_mock_predictions,
    tokenize_text,
)

logger = logging.getLogger(__name__)


class ViSoNormModel:
    """Wrapper around the ViSoNorm HuggingFace model with graceful fallback."""

    def __init__(
        self,
        model_repo: str,
        device: str = "cpu",
        max_text_length: int = 5000,
    ):
        self.model_repo = model_repo
        self.device = device
        self.max_text_length = max_text_length
        self.tokenizer = None
        self.model = None
        self._backend = "mock"

        self._load_model()

    def _load_model(self) -> None:
        try:
            if AutoTokenizer is None or AutoModelForMaskedLM is None or torch is None:
                raise RuntimeError("Required ML dependencies are unavailable")

            self.tokenizer = AutoTokenizer.from_pretrained(self.model_repo)
            self.model = AutoModelForMaskedLM.from_pretrained(
                self.model_repo,
                trust_remote_code=True,
            )
            self.model.to(self.device)
            self.model.eval()
            self._backend = "remote"
            logger.info("Successfully loaded ViSoNorm model from %s", self.model_repo)
        except Exception as exc:  # pragma: no cover - depends on internet
            logger.warning(
                "Falling back to mock ViSoNorm model due to load failure: %s", exc
            )
            self.tokenizer = None
            self.model = None
            self._backend = "mock"

        if self._backend == "mock":
            if not MOCK_REPLACEMENTS:
                raise ModelLoadError("No mock replacements available for fallback mode")
            logger.info("ViSoNorm running in mock mode")

    def _ensure_length(self, text: str) -> None:
        if len(text) > self.max_text_length:
            raise TextProcessingError(
                f"Input text exceeds maximum length of {self.max_text_length} characters"
            )

    def normalize_text(self, text: str, device: str | None = None):
        self._ensure_length(text)

        if (
            self._backend == "remote"
            and self.model is not None
            and self.tokenizer is not None
            and torch is not None
        ):
            with torch.no_grad():  # pragma: no cover - requires heavy model
                normalized_text, source_tokens, predicted_tokens = (
                    self.model.normalize_text(  # type: ignore[attr-defined]
                        self.tokenizer,
                        text,
                        device=device or self.device,
                    )
                )
            return {
                "original": text,
                "normalized": normalized_text,
                "source_tokens": source_tokens,
                "predicted_tokens": predicted_tokens,
            }

        return self._mock_normalize(text)

    def detect_nsw(self, text: str, device: str | None = None):
        self._ensure_length(text)

        if (
            self._backend == "remote"
            and self.model is not None
            and self.tokenizer is not None
            and torch is not None
        ):
            with torch.no_grad():  # pragma: no cover - requires heavy model
                nsw_results = self.model.detect_nsw(  # type: ignore[attr-defined]
                    self.tokenizer,
                    text,
                    device=device or self.device,
                )
            return nsw_results

        return self._mock_detect(text)

    def _mock_normalize(self, text: str):
        tokens = tokenize_text(text)
        normalized_tokens: List[str] = []
        predicted_tokens: List[str] = []

        for token in tokens:
            normalized_word, predicted = generate_mock_predictions(token)
            normalized_tokens.append(normalized_word)
            predicted_tokens.append(predicted)

        return {
            "original": text,
            "normalized": " ".join(normalized_tokens),
            "source_tokens": tokens,
            "predicted_tokens": predicted_tokens,
        }

    def _mock_detect(self, text: str):
        tokens = tokenize_text(text)
        results = []
        position = 0

        for index, token in enumerate(tokens):
            start_index = text.find(token, position)
            end_index = start_index + len(token)
            position = end_index

            if token.lower() in MOCK_REPLACEMENTS:
                prediction = MOCK_REPLACEMENTS[token.lower()]
                results.append(
                    {
                        "index": index,
                        "start_index": start_index,
                        "end_index": end_index,
                        "nsw": token,
                        "prediction": prediction,
                        "confidence_score": 0.75,
                    }
                )

        return results

