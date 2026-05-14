"""
정책 데이터 로더 — JSON 기반 정책 시스템
코드 수정 없이 정책 데이터 변경만으로 세법/건보료 기준 변경 대응
"""

import json
from pathlib import Path
from functools import lru_cache
from typing import Any

from app.core.config import get_settings


class PolicyLoader:
    def __init__(self, policies_dir: str, year: str):
        self._dir = Path(policies_dir) / year
        self._cache: dict[str, Any] = {}

    def _load(self, name: str) -> dict:
        if name not in self._cache:
            path = self._dir / f"{name}.json"
            if not path.exists():
                raise FileNotFoundError(f"Policy file not found: {path}")
            with open(path, "r", encoding="utf-8") as f:
                self._cache[name] = json.load(f)
        return self._cache[name]

    @property
    def tax(self) -> dict:
        return self._load("tax")

    @property
    def health_insurance(self) -> dict:
        return self._load("health_insurance")

    @property
    def pension(self) -> dict:
        return self._load("pension")

    @property
    def macro(self) -> dict:
        return self._load("macro")

    def get_tax_brackets(self) -> list[dict]:
        return self.tax["income_tax_brackets"]

    def get_health_insurance_rate(self) -> float:
        return self.health_insurance["premium_rate"]["combined_rate"]

    def get_ltc_rate(self) -> float:
        return self.health_insurance["long_term_care_rate"]

    def get_pension_withdrawal_rates(self) -> dict:
        return self.pension["private_pension"]["tax_rates"]

    def get_asset_returns(self) -> dict:
        return self.macro["asset_returns"]

    def get_correlation_matrix(self) -> dict:
        return self.macro["correlation_matrix"]

    def get_stress_scenarios(self) -> dict:
        return self.macro["stress_scenarios"]

    def get_longevity(self) -> dict:
        return self.macro["longevity"]

    def get_inflation(self) -> dict:
        return self.macro["inflation"]


@lru_cache()
def get_policy_loader() -> PolicyLoader:
    settings = get_settings()
    return PolicyLoader(settings.policies_dir, settings.active_policy_year)
