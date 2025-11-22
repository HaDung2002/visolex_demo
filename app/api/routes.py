from __future__ import annotations

import time
from typing import Any, Dict

from flask import current_app, jsonify, request

from app.utils.error_handling import TextProcessingError, ViSoLexException
from app.models.processor import ViSoLexProcessor
from . import api_bp
from .schemas import BatchProcessRequest, DetectNSWRequest, NormalizeRequest


def _get_processor() -> ViSoLexProcessor:
    model = current_app.config.get("VISONORM_MODEL")
    if model is None:
        raise TextProcessingError("Model is not loaded")
    return ViSoLexProcessor(model=model)


def _success_response(payload: Dict[str, Any], status: int = 200):
    payload.setdefault("success", True)
    return jsonify(payload), status


@api_bp.route("/normalize", methods=["POST"])
def normalize_text():
    data = request.get_json() or {}
    normalize_req = NormalizeRequest.from_dict(data)
    processor = _get_processor()

    start_time = time.perf_counter()
    result = processor.normalize_text(
        text=normalize_req.text,
        device=normalize_req.device,
    )
    elapsed = time.perf_counter() - start_time

    response = {
        "original_text": result["original"],
        "normalized_text": result["normalized"],
        "source_tokens": result["source_tokens"],
        "predicted_tokens": result["predicted_tokens"],
        "processing_time": elapsed,
    }
    return _success_response(response)


@api_bp.route("/detect-nsw", methods=["POST"])
def detect_nsw():
    data = request.get_json() or {}
    detect_req = DetectNSWRequest.from_dict(data)
    processor = _get_processor()

    start_time = time.perf_counter()
    nsw_results = processor.detect_nsw(
        text=detect_req.text,
        device=detect_req.device,
    )
    elapsed = time.perf_counter() - start_time

    response = {
        "text": detect_req.text,
        "nsw_count": len(nsw_results),
        "results": nsw_results,
        "processing_time": elapsed,
    }
    return _success_response(response)


@api_bp.route("/batch-process", methods=["POST"])
def batch_process():
    data = request.get_json() or {}
    batch_req = BatchProcessRequest.from_dict(data)
    processor = _get_processor()

    start_time = time.perf_counter()
    results = processor.batch_process(
        texts=batch_req.texts,
        mode=batch_req.mode,
        device=batch_req.device,
    )
    elapsed = time.perf_counter() - start_time

    response = {
        "total_texts": len(batch_req.texts),
        "mode": batch_req.mode,
        "results": results,
        "total_processing_time": elapsed,
    }
    return _success_response(response)


@api_bp.errorhandler(ViSoLexException)
def handle_visolex_errors(exc: ViSoLexException):
    return jsonify({"success": False, "error": str(exc)}), 400


@api_bp.errorhandler(Exception)
def handle_general_errors(exc: Exception):
    current_app.logger.exception("Unhandled exception: %s", exc, exc_info=exc)
    return jsonify({"success": False, "error": "Internal server error"}), 500

