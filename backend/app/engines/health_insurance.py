"""
건강보험료 계산 엔진
국민건강보험공단 2026년 기준

지역가입자: 소득보험료 + 재산보험료 + 자동차보험료
피부양자 자격 판정 및 박탈 로직 포함
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
import math

from app.core.policy_loader import get_policy_loader


class SubscriberType(str, Enum):
    EMPLOYEE = "employee"
    REGIONAL = "regional"
    DEPENDENT = "dependent"


@dataclass
class HealthInsuranceInput:
    subscriber_type: SubscriberType

    # 소득 (연간)
    employment_income: int = 0
    business_income: int = 0
    financial_income: int = 0       # 이자 + 배당
    pension_income_public: int = 0  # 국민연금 등 공적연금
    pension_income_private: int = 0 # 사적연금 (연금저축/IRP)
    rental_income: int = 0
    other_income: int = 0
    overseas_stock_gain: int = 0    # 해외주식 양도소득

    # 재산 (공시가)
    real_estate_assessed: int = 0   # 부동산 공시가액
    financial_assets: int = 0       # 금융자산

    # 자동차
    vehicle_value: int = 0
    vehicle_displacement_cc: int = 0
    vehicle_age_years: int = 0

    # 피부양자 여부
    is_dependent_candidate: bool = False


@dataclass
class HealthInsuranceResult:
    subscriber_type: SubscriberType
    monthly_premium: int
    annual_premium: int
    ltc_premium_monthly: int
    total_monthly: int       # 건보료 + 장기요양
    total_annual: int

    # 지역가입자 세부
    income_premium: int = 0
    property_premium: int = 0
    vehicle_premium: int = 0

    # 피부양자 판정
    is_dependent_eligible: bool = False
    dependent_disqualification_reasons: list[str] = field(default_factory=list)
    dependency_risk_score: float = 0.0

    # 경고
    alerts: list[str] = field(default_factory=list)


class HealthInsuranceEngine:
    def __init__(self):
        self._policy = get_policy_loader().health_insurance

    def calculate(self, inp: HealthInsuranceInput) -> HealthInsuranceResult:
        if inp.subscriber_type == SubscriberType.EMPLOYEE:
            return self._calculate_employee(inp)
        elif inp.subscriber_type == SubscriberType.REGIONAL:
            return self._calculate_regional(inp)
        else:
            return self._calculate_dependent(inp)

    # ── 직장가입자 ──────────────────────────────────────────────────────────
    def _calculate_employee(self, inp: HealthInsuranceInput) -> HealthInsuranceResult:
        rate = self._policy["premium_rate"]["employee_rate"]
        monthly_salary = inp.employment_income / 12
        monthly_premium = math.floor(monthly_salary * rate)

        # 직장가입자도 보수 외 소득(금융/임대 등) 2천만원 초과 시 추가 부과
        extra_income = self._extra_income_for_employee(inp)
        extra_premium = 0
        if extra_income > 20_000_000:
            extra_monthly = (extra_income - 20_000_000) / 12
            extra_premium = math.floor(extra_monthly * rate)
            monthly_premium += extra_premium

        ltc_rate = self._policy["long_term_care_rate"]
        ltc_monthly = math.floor(monthly_premium * ltc_rate)
        total_monthly = monthly_premium + ltc_monthly

        alerts = self._build_alerts(inp, monthly_premium)

        return HealthInsuranceResult(
            subscriber_type=SubscriberType.EMPLOYEE,
            monthly_premium=monthly_premium,
            annual_premium=monthly_premium * 12,
            ltc_premium_monthly=ltc_monthly,
            total_monthly=total_monthly,
            total_annual=total_monthly * 12,
            alerts=alerts,
        )

    def _extra_income_for_employee(self, inp: HealthInsuranceInput) -> int:
        public_pension_50 = math.floor(inp.pension_income_public * 0.5)
        return (
            inp.financial_income
            + inp.rental_income
            + inp.business_income
            + public_pension_50
            + inp.pension_income_private
            + inp.other_income
        )

    # ── 지역가입자 ──────────────────────────────────────────────────────────
    def _calculate_regional(self, inp: HealthInsuranceInput) -> HealthInsuranceResult:
        income_premium = self._income_premium_regional(inp)
        property_premium = self._property_premium(inp)
        vehicle_premium = self._vehicle_premium(inp)

        regional_cfg = self._policy["regional_subscriber"]
        min_premium = regional_cfg["min_premium"]

        monthly_premium = max(
            income_premium + property_premium + vehicle_premium,
            min_premium,
        )

        ltc_rate = self._policy["long_term_care_rate"]
        ltc_monthly = math.floor(monthly_premium * ltc_rate)
        total_monthly = monthly_premium + ltc_monthly

        alerts = self._build_alerts(inp, monthly_premium)

        return HealthInsuranceResult(
            subscriber_type=SubscriberType.REGIONAL,
            monthly_premium=monthly_premium,
            annual_premium=monthly_premium * 12,
            ltc_premium_monthly=ltc_monthly,
            total_monthly=total_monthly,
            total_annual=total_monthly * 12,
            income_premium=income_premium,
            property_premium=property_premium,
            vehicle_premium=vehicle_premium,
            alerts=alerts,
        )

    def _income_premium_regional(self, inp: HealthInsuranceInput) -> int:
        """
        2022년 9월 개편: 지역가입자 소득보험료 = 소득 × 8.09% / 12
        공적연금 50%, 사적연금 100% 반영
        """
        rate = self._policy["regional_subscriber"]["income_score"]["rate"]
        public_pension_50 = math.floor(inp.pension_income_public * 0.5)
        total_income = (
            inp.employment_income
            + inp.business_income
            + inp.financial_income
            + public_pension_50
            + inp.pension_income_private
            + inp.rental_income
            + inp.other_income
            + inp.overseas_stock_gain
        )
        monthly_income = total_income / 12
        return math.floor(monthly_income * rate)

    def _property_premium(self, inp: HealthInsuranceInput) -> int:
        """재산 점수 × 208.4원"""
        cfg = self._policy["regional_subscriber"]["property_score"]
        score = 0
        total_property = inp.real_estate_assessed

        for bracket in cfg["table"]:
            lo = bracket["min"]
            hi = bracket["max"]
            if hi is None or total_property <= hi:
                if total_property >= lo:
                    score = bracket["score"]
                    break
        unit = cfg["score_unit_price"]
        return math.floor(score * unit)

    def _vehicle_premium(self, inp: HealthInsuranceInput) -> int:
        """자동차 보험료: 4천만원 미만 또는 9년 이상 면제"""
        cfg = self._policy["regional_subscriber"]["vehicle_score"]
        if inp.vehicle_value < cfg["exempt_below"]:
            return 0
        if inp.vehicle_age_years >= cfg["exempt_age_years"]:
            return 0

        score = 0
        for bracket in cfg["table"]:
            if inp.vehicle_displacement_cc <= (bracket["displacement"] or 99999):
                score = bracket["score"]
                break
        unit = cfg["score_unit_price"]
        return math.floor(score * unit)

    # ── 피부양자 ────────────────────────────────────────────────────────────
    def _calculate_dependent(self, inp: HealthInsuranceInput) -> HealthInsuranceResult:
        eligible, reasons = self._check_dependent_eligibility(inp)
        risk_score = self._dependent_risk_score(inp)

        return HealthInsuranceResult(
            subscriber_type=SubscriberType.DEPENDENT,
            monthly_premium=0,
            annual_premium=0,
            ltc_premium_monthly=0,
            total_monthly=0,
            total_annual=0,
            is_dependent_eligible=eligible,
            dependent_disqualification_reasons=reasons,
            dependency_risk_score=risk_score,
            alerts=self._build_alerts(inp, 0),
        )

    def _check_dependent_eligibility(self, inp: HealthInsuranceInput) -> tuple[bool, list[str]]:
        """피부양자 자격 판정 로직"""
        cfg = self._policy["dependent_eligibility"]
        reasons = []

        total_income = (
            inp.employment_income
            + inp.business_income
            + inp.financial_income
            + inp.pension_income_public
            + inp.pension_income_private
            + inp.rental_income
            + inp.other_income
        )
        if total_income > cfg["income_threshold"]:
            reasons.append(f"연소득 {total_income:,}원 > 2,000만원 기준 초과")

        if inp.financial_income > cfg["financial_income_threshold"]:
            reasons.append(f"금융소득 {inp.financial_income:,}원 > 1,000만원 기준 초과")

        if inp.real_estate_assessed > cfg["property_threshold"]:
            reasons.append(f"재산 {inp.real_estate_assessed:,}원 > 5.4억원 기준 초과")
            if total_income > cfg["property_income_threshold_high_property"]:
                reasons.append("재산 5.4억 초과 + 연소득 1,000만원 초과")

        if inp.business_income > 0:
            reasons.append("사업소득 발생으로 피부양자 자격 불가")

        return len(reasons) == 0, reasons

    def _dependent_risk_score(self, inp: HealthInsuranceInput) -> float:
        """피부양자 탈락 위험도 0~1"""
        cfg = self._policy["dependent_eligibility"]
        score = 0.0

        income = (
            inp.financial_income
            + inp.pension_income_public
            + inp.pension_income_private
            + inp.rental_income
        )
        score += min(income / cfg["income_threshold"], 1.0) * 0.5
        score += min(inp.financial_income / cfg["financial_income_threshold"], 1.0) * 0.3
        score += min(inp.real_estate_assessed / cfg["property_threshold"], 1.0) * 0.2
        return round(min(score, 1.0), 4)

    # ── 경고 메시지 ─────────────────────────────────────────────────────────
    def _build_alerts(self, inp: HealthInsuranceInput, monthly_premium: int) -> list[str]:
        alerts = []
        alert_cfg = self._policy["alerts"]

        if inp.financial_income >= alert_cfg["financial_income_warning"]:
            alerts.append(
                f"⚠️ 금융소득 {inp.financial_income:,}원이 종합과세 기준(2천만원)에 도달했습니다. "
                "건보료 및 종합과세 영향을 검토하세요."
            )
        elif inp.financial_income >= alert_cfg["dependent_risk_income"]:
            alerts.append(
                f"⚠️ 금융소득 {inp.financial_income:,}원이 피부양자 탈락 위험 구간(1,800만원)입니다."
            )

        dep_income = inp.financial_income + inp.pension_income_private + inp.pension_income_public
        if dep_income > 18_000_000 and inp.is_dependent_candidate:
            alerts.append(
                "⚠️ 피부양자 탈락 가능성 — 소득이 2,000만원에 근접했습니다. "
                "지역가입자로 전환 시 건보료를 미리 계산해 보세요."
            )

        if inp.pension_income_private > 15_000_000:
            alerts.append(
                f"⚠️ 사적연금 {inp.pension_income_private:,}원이 분리과세 한도(1,500만원)를 초과합니다. "
                "종합과세 전환 여부를 검토하세요."
            )

        return alerts

    # ── 연도별 시뮬레이션 헬퍼 ─────────────────────────────────────────────
    def project_premium_years(
        self,
        base_input: HealthInsuranceInput,
        years: int,
        inflation_rate: float = 0.025,
        income_growth_rates: Optional[dict[int, float]] = None,
    ) -> list[HealthInsuranceResult]:
        """연도별 건보료 예측 (인플레이션 반영)"""
        results = []
        current = base_input

        for year in range(years):
            result = self.calculate(current)
            results.append(result)

            # 다음 해 소득 성장 반영
            growth = inflation_rate
            if income_growth_rates and year in income_growth_rates:
                growth = income_growth_rates[year]

            current = HealthInsuranceInput(
                subscriber_type=current.subscriber_type,
                employment_income=int(current.employment_income * (1 + growth)),
                business_income=int(current.business_income * (1 + growth)),
                financial_income=int(current.financial_income * (1 + growth)),
                pension_income_public=int(current.pension_income_public * (1 + inflation_rate)),
                pension_income_private=int(current.pension_income_private),
                rental_income=int(current.rental_income * (1 + growth)),
                other_income=int(current.other_income),
                overseas_stock_gain=int(current.overseas_stock_gain),
                real_estate_assessed=int(current.real_estate_assessed * (1 + 0.03)),
                financial_assets=int(current.financial_assets),
                vehicle_value=current.vehicle_value,
                vehicle_displacement_cc=current.vehicle_displacement_cc,
                vehicle_age_years=current.vehicle_age_years + 1,
                is_dependent_candidate=current.is_dependent_candidate,
            )

        return results
