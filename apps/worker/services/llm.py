from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from openai import OpenAI

from apps.common.config import get_settings
from apps.common.supabase import get_supabase

LOGGER = logging.getLogger(__name__)

SCHEMA = {
    "type": "object",
    "properties": {
        "country": {"enum": ["UK", "IE"]},
        "employer_name": {"type": "string", "nullable": True},
        "pay_date": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$", "nullable": True},
        "period_start": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$", "nullable": True},
        "period_end": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$", "nullable": True},
        "currency": {"enum": ["GBP", "EUR"]},
        "gross": {"type": "number"},
        "net": {"type": "number"},
        "tax_income": {"type": "number"},
        "ni_prsi": {"type": "number"},
        "pension_employee": {"type": "number"},
        "pension_employer": {"type": "number"},
        "student_loan": {"type": "number"},
        "other_deductions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "amount": {"type": "number"},
                },
            },
        },
        "ytd": {"type": "object"},
        "tax_code": {"type": "string", "nullable": True},
        "confidence_overall": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": [
        "country",
        "currency",
        "gross",
        "net",
        "tax_income",
        "ni_prsi",
        "pension_employee",
        "student_loan",
        "other_deductions",
        "ytd",
        "confidence_overall",
    ],
    "additionalProperties": False,
}


@dataclass(slots=True)
class LlmResponse:
    payload: Dict[str, Any]
    tokens: int
    cost: float


class SpendCapExceeded(RuntimeError):
    pass


class LlmVisionClient:
    MODEL = "gpt-5"

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY missing")
        self._client = OpenAI(api_key=settings.openai_api_key)
        self._cap = settings.llm_spend_daily_cap_usd
        self._supabase = get_supabase()

    def _todays_spend(self, user_id: str) -> float:
        today = datetime.now(timezone.utc).date().isoformat()
        response = (
            self._supabase.client.table("llm_usage")
            .select("cost")
            .eq("user_id", user_id)
            .gte("created_at", f"{today}T00:00:00Z")
            .execute()
        )
        costs = [row.get("cost", 0.0) for row in (response.data or [])]
        return float(sum(costs))

    def _record_usage(self, user_id: str, tokens: int, cost: float, *, file_id: Optional[str]) -> None:
        self._supabase.insert_row(
            "llm_usage",
            {
                "user_id": user_id,
                "file_id": file_id,
                "model": self.MODEL,
                "tokens_input": tokens,
                "tokens_output": 0,
                "cost": cost,
            },
        )

    def infer(self, *, user_id: str, file_id: Optional[str], redacted_images: list[bytes]) -> LlmResponse:
        spend = self._todays_spend(user_id)
        LOGGER.info("LLM spend check", extra={"user_id": user_id, "spend": spend, "cap": self._cap})
        if spend >= self._cap:
            raise SpendCapExceeded(f"Daily spend cap {self._cap} reached")
        content = [
            {
                "type": "input_image",
                "image_bytes": image,
            }
            for image in redacted_images
        ]
        result = self._client.responses.create(
            model=self.MODEL,
            temperature=0,
            response_format={"type": "json_schema", "json_schema": {"name": "PayslipExtraction", "schema": SCHEMA}},
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract payslip key values as per schema.",
                        },
                        *content,
                    ],
                }
            ],
        )
        try:
            output = result.output[0].content[0].text  # type: ignore[index]
        except (AttributeError, IndexError, KeyError) as exc:  # pragma: no cover - unexpected schema
            LOGGER.error("Unexpected LLM response payload: %s", exc)
            raise RuntimeError("Invalid LLM response") from exc
        payload = json.loads(output)
        tokens = result.usage.total_tokens if result.usage else 0
        cost = getattr(result, "usage", None)
        cost_value = 0.0
        if cost and getattr(cost, "total_tokens", None):
            cost_value = round(cost.total_tokens * 0.00015, 4)
        self._record_usage(user_id, tokens, cost_value, file_id=file_id)
        return LlmResponse(payload=payload, tokens=tokens, cost=cost_value)


__all__ = ["LlmVisionClient", "LlmResponse", "SpendCapExceeded", "SCHEMA"]
