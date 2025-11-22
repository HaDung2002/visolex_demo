import re
from typing import Dict, Tuple

MOCK_REPLACEMENTS: Dict[str, str] = {
    "sv": "sinh viên",
    "dh": "đại học",
    "gia": "gia",
    "dinh": "đình",
    "chua": "chưa",
    "cho": "cho",
    "di": "đi",
    "lam": "làm",
    "ko": "không",
    "k": "không",
    "bt": "bình thường",
    "mn": "mọi người",
    "vs": "với",
    "hok": "không",
    "nhe": "nhé",
}


def tokenize_text(text: str):
    cleaned = re.sub(r"\s+", " ", text.strip())
    return cleaned.split(" ") if cleaned else []


def generate_mock_predictions(token: str) -> Tuple[str, str]:
    lower = token.lower()
    if lower in MOCK_REPLACEMENTS:
        prediction = MOCK_REPLACEMENTS[lower]
    else:
        prediction = token
    return prediction, prediction

