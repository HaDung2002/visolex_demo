from __future__ import annotations

import time
from typing import List

from app.models.normalizer import ViSoNormModel


class ViSoLexProcessor:
    """High-level processor that orchestrates interactions with ViSoNormModel."""

    def __init__(self, model: ViSoNormModel):
        self.model = model

    def normalize_text(self, text: str, device: str | None = None):
        return self.model.normalize_text(text=text, device=device)

    def detect_nsw(self, text: str, device: str | None = None):
        return self.model.detect_nsw(text=text, device=device)

    def batch_process(self, texts: List[str], mode: str, device: str | None = None):
        results = []

        for text in texts:
            start_time = time.perf_counter()
            if mode == "normalize":
                normalized = self.normalize_text(text=text, device=device)
                processing_time = time.perf_counter() - start_time
                results.append(
                    {
                        "original": normalized["original"],
                        "normalized": normalized["normalized"],
                        "processing_time": processing_time,
                    }
                )
            else:
                nsw = self.detect_nsw(text=text, device=device)
                processing_time = time.perf_counter() - start_time
                results.append(
                    {
                        "text": text,
                        "nsw_count": len(nsw),
                        "results": nsw,
                        "processing_time": processing_time,
                    }
                )

        return results

