from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List

from .pdf import render_redacted_preview

LOGGER = logging.getLogger(__name__)

# Regex heuristics for UK/IE identifiers
NI_REGEX = re.compile(r"\b([A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D])\b", re.IGNORECASE)
PPS_REGEX = re.compile(r"\b\d{7}[A-W]\b", re.IGNORECASE)
IBAN_REGEX = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b")
DOB_REGEX = re.compile(r"\b\d{2}[\-/]\d{2}[\-/]\d{2,4}\b")
POSTCODE_REGEX = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2}\b", re.IGNORECASE)
ADDRESS_REGEX = re.compile(r"\b\d+\s+[A-Z][A-Za-z]+(?:\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln))\b", re.IGNORECASE)

SENSITIVE_PATTERNS: Dict[str, Iterable[re.Pattern[str]]] = {
    "ni": [NI_REGEX],
    "pps": [PPS_REGEX],
    "iban": [IBAN_REGEX],
    "dob": [DOB_REGEX],
    "address": [POSTCODE_REGEX, ADDRESS_REGEX],
}


@dataclass(slots=True)
class RedactionResult:
    redacted_text: str
    boxes: List[Dict[str, float]]
    preview_png: bytes


def redact_text(raw_text: str) -> RedactionResult:
    boxes: List[Dict[str, float]] = []
    redacted_text = raw_text
    total_hits = 0
    for label, patterns in SENSITIVE_PATTERNS.items():
        for pattern in patterns:
            for match_index, match in enumerate(pattern.finditer(raw_text)):
                start, end = match.span()
                token = match.group(0)
                redacted_text = redacted_text.replace(token, "█" * len(token))
                boxes.append(
                    {
                        "x": 0.05,
                        "y": min(0.9, 0.05 + 0.08 * total_hits),
                        "w": 0.9,
                        "h": 0.06,
                        "label": label,
                    }
                )
                total_hits += 1
    preview_png = render_redacted_preview(redacted_text or "Redaction preview unavailable")
    return RedactionResult(redacted_text=redacted_text, boxes=boxes, preview_png=preview_png)


__all__ = ["redact_text", "RedactionResult"]
