"""
연금 인출 최적화 엔진
- 연령별 세율 비교
- 분리과세 vs 종합과세 최적 선택
- ISA → 연금저축 이전 전략
- 연금 개시 시점 최적화
- 건보료 영향 통합
"""

from __future__ import annotations
from dataclasses import dataclass, field
import math

from app.core.policy_loader import get_policy_loader


@dataclass
class PensionWithdrawalInput:
    current_age: int
    pension_savings_balance: int
    irp_balance: int
    isa_balance: int

    # 다른 소득 (연금 외)
    national_pension_monthly: int = 0
    other_annual_income: int = 0
    financial_income: int = 0

    # 목표 월 생활비
    target_monthly_expense: int = 3_000_000

    # 연금 개시 예정 나이
    planned_start_age: int = 65
    spouse_age: Optional[int] = None


@dataclass
class PensionWithdrawalPlan:
    start_age: int
    monthly_withdrawal: int
    annual_withdrawal: int
    annual_tax: int
    effective_tax_rate: float
    health_insurance_impact_monthly: int
    net_monthly: int
    strategy: str
    notes: list[str] = field(default_factory=list)


@dataclass
class PensionComparisonResult:
    plans: list[PensionWithdrawalPlan]
    recommended_start_age: int
    recommended_strategy: str
    isa_transfer_benefit: dict
    optimization_summary: str


class PensionWithdrawalEngine:
    def __init__(self):
        self._policy = get_policy_loader()
        self._pension_policy = self._policy.pension
        self._tax_policy = self._policy.tax

    def optimize(self, inp: PensionWithdrawalInput) -> PensionComparisonResult:
        """연금 개시 시점 및 전략 최적화"""
        plans = []

        # 55~75세 시작 시 비교
        for start_age in range(55, 76, 5):
            for strategy in ["separate", "comprehensive"]:
                plan = self._calculate_plan(inp, start_age, strategy)
                plans.append(plan)

        # ISA → 연금저축 이전 효과
        isa_benefit = self._calculate_isa_transfer_benefit(inp)

        # 최적 추천
        best = min(plans, key=lambda p: p.annual_tax - p.net_monthly * 12 * -1)

        return PensionComparisonResult(
            plans=plans,
            recommended_start_age=best.start_age,
            recommended_strategy=best.strategy,
            isa_transfer_benefit=isa_benefit,
            optimization_summary=self._summarize(best, isa_benefit),
        )

    def _calculate_plan(
        self, inp: PensionWithdrawalInput, start_age: int, strategy: str
    ) -> PensionWithdrawalPlan:
        rates = self._pension_policy["private_pension"]["tax_rates"]
        withdraw_tax_policy = self._tax_policy["pension_accounts"]["pension_withdrawal_tax"]

        # 연금 계좌 잔액 (시작 나이까지 운용)
        years_to_start = max(start_age - inp.current_age, 0)
        growth_rate = 0.05
        total_balance = (
            (inp.pension_savings_balance + inp.irp_balance)
            * (1 + growth_rate) ** years_to_start
        )

        # 최소 10년 수령 기준 월 인출액
        remaining_years = max(100 - start_age, 10)
        monthly_withdrawal = int(total_balance / (remaining_years * 12))
        annual_withdrawal = monthly_withdrawal * 12

        # 연금소득세 계산
        if start_age < 70:
            rate = rates["age_55_69"]   # 55~69세: 5.5%
        elif start_age < 80:
            rate = rates["age_70_79"]   # 70~79세: 4.4%
        else:
            rate = rates["age_80_plus"] # 80세+: 3.3%

        separate_limit = withdraw_tax_policy["separate_tax_limit"]

        if strategy == "separate":
            if annual_withdrawal <= separate_limit:
                annual_tax = math.floor(annual_withdrawal * rate)
            else:
                annual_tax = math.floor(separate_limit * rate) + math.floor(
                    (annual_withdrawal - separate_limit) * withdraw_tax_policy["over_threshold_rate"]
                )
        else:
            # 종합과세: 단순 종합소득 합산 기준 계산 (실제는 TaxEngine 활용)
            total_income = (
                annual_withdrawal
                + inp.national_pension_monthly * 12
                + inp.financial_income
                + inp.other_annual_income
            )
            brackets = self._tax_policy["income_tax_brackets"]
            annual_tax = self._apply_brackets(total_income, brackets)

        # 건보료 영향 (지역가입자 기준, 사적연금 100% 반영)
        hi_rate = self._policy.health_insurance["regional_subscriber"]["income_score"]["rate"]
        hi_monthly = math.floor(annual_withdrawal / 12 * hi_rate)

        effective_rate = annual_tax / annual_withdrawal if annual_withdrawal > 0 else 0
        net_monthly = monthly_withdrawal - math.floor(annual_tax / 12) - hi_monthly

        notes = []
        if annual_withdrawal > separate_limit:
            notes.append(f"사적연금 {annual_withdrawal:,}원 > 분리과세 한도 {separate_limit:,}원")
        if start_age >= 70:
            notes.append(f"70세 이상 연금소득세율 {rate*100:.1f}% 적용으로 절세 효과 극대화")
        if years_to_start > 0:
            notes.append(f"{years_to_start}년간 운용 후 수령 — 복리 효과 반영")

        return PensionWithdrawalPlan(
            start_age=start_age,
            monthly_withdrawal=monthly_withdrawal,
            annual_withdrawal=annual_withdrawal,
            annual_tax=annual_tax,
            effective_tax_rate=round(effective_rate, 4),
            health_insurance_impact_monthly=hi_monthly,
            net_monthly=net_monthly,
            strategy=strategy,
            notes=notes,
        )

    def _calculate_isa_transfer_benefit(self, inp: PensionWithdrawalInput) -> dict:
        """ISA 만기 → 연금저축 이전 시 세액공제 효과"""
        transfer_policy = self._tax_policy["isa"]["pension_transfer"]
        isa_balance = inp.isa_balance

        # 이전 금액의 10%, 최대 300만원 세액공제
        additional_credit = min(
            math.floor(isa_balance * transfer_policy["additional_deduction_rate"]),
            transfer_policy["max_additional_deduction"],
        )
        # ISA 비과세 효과 (일반형 기준 200만원)
        isa_tax_free = self._tax_policy["isa"]["types"]["general"]["tax_free_limit"]

        total_benefit = additional_credit + math.floor(isa_tax_free * 0.154)

        return {
            "isa_balance": isa_balance,
            "transfer_tax_credit": additional_credit,
            "isa_tax_free_benefit": isa_tax_free,
            "total_annual_benefit": total_benefit,
            "recommendation": (
                "ISA 만기 후 연금저축 이전 권장"
                if isa_balance > 10_000_000
                else "ISA 잔액 소액 — 연간 납입 한도 활용 검토"
            ),
        }

    def _apply_brackets(self, income: int, brackets: list[dict]) -> int:
        tax = 0
        for b in brackets:
            lo = b["min"]
            hi = b["max"]
            if income <= lo:
                break
            if hi is None or income <= hi:
                tax = math.floor((income - lo) * b["rate"]) + b["deduction"]
                break
        return max(tax, 0)

    def _summarize(self, best: PensionWithdrawalPlan, isa_benefit: dict) -> str:
        return (
            f"{best.start_age}세 개시, {best.strategy} 전략 권장. "
            f"월 실수령 {best.net_monthly:,}원, 연 세금 {best.annual_tax:,}원. "
            f"ISA 이전 추가 절세 효과 연 {isa_benefit['total_annual_benefit']:,}원."
        )


# Optional typing fix
from typing import Optional
