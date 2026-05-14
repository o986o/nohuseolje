"""
상속/증여세 엔진
배우자 증여 절세 전략 포함
취득가액 승계 효과 계산
"""

from __future__ import annotations
from dataclasses import dataclass, field
import math
from app.core.policy_loader import get_policy_loader


@dataclass
class EstateInput:
    total_assets: int
    has_spouse: bool = True
    spouse_share: float = 0.5
    financial_asset_ratio: float = 0.30
    real_estate_ratio: float = 0.40
    num_children: int = 2
    prior_gifts_spouse: int = 0       # 10년 내 배우자 증여 누적
    prior_gifts_children: int = 0     # 10년 내 자녀 증여 누적


@dataclass
class EstateResult:
    gross_estate: int
    total_deduction: int
    taxable_estate: int
    inheritance_tax: int
    effective_rate: float
    breakdown: dict
    reduction_strategies: list[str]


@dataclass
class GiftStrategy:
    remaining_spouse_deduction: int
    optimal_gift_amount: int
    tax_saving_vs_inheritance: int
    acquisition_cost_tax_saving: int
    total_benefit: int
    recommended_timing: str
    notes: list[str]


class EstateGiftTaxEngine:
    def __init__(self):
        self._policy = get_policy_loader().tax
        self._gift_cfg = self._policy["gift_tax"]
        self._inh_cfg = self._policy["inheritance_tax"]

    def calculate_estate(self, inp: EstateInput) -> EstateResult:
        # 공제 계산
        basic_deduction = self._inh_cfg["basic_deduction"]
        lump_sum = self._inh_cfg["lump_sum_deduction"]

        spouse_deduction = 0
        if inp.has_spouse:
            spouse_actual = math.floor(inp.total_assets * inp.spouse_share)
            spouse_deduction = max(
                min(spouse_actual, self._inh_cfg["spouse_deduction_max"]),
                self._inh_cfg["spouse_deduction_min"],
            )

        financial_deduction = min(
            math.floor(inp.total_assets * inp.financial_asset_ratio * 0.20),
            self._inh_cfg["financial_asset_deduction_max"],
        )

        itemized = basic_deduction + spouse_deduction + financial_deduction
        total_deduction = max(itemized, lump_sum + (spouse_deduction if inp.has_spouse else 0))
        total_deduction = min(total_deduction, inp.total_assets)

        taxable = max(inp.total_assets - total_deduction, 0)
        inheritance_tax = self._apply_brackets(taxable, self._inh_cfg["brackets"])

        strategies = self._generate_reduction_strategies(inp, inheritance_tax)

        return EstateResult(
            gross_estate=inp.total_assets,
            total_deduction=total_deduction,
            taxable_estate=taxable,
            inheritance_tax=inheritance_tax,
            effective_rate=round(inheritance_tax / inp.total_assets, 4) if inp.total_assets > 0 else 0,
            breakdown={
                "basic_deduction": basic_deduction,
                "spouse_deduction": spouse_deduction,
                "financial_deduction": financial_deduction,
                "lump_sum_deduction": lump_sum,
            },
            reduction_strategies=strategies,
        )

    def calculate_gift_strategy(
        self,
        total_assets: int,
        overseas_stock_value: int,
        overseas_stock_acquisition_cost: int,
        prior_gifts_spouse: int = 0,
    ) -> GiftStrategy:
        """배우자 증여 최적 전략"""
        spouse_deduction = self._gift_cfg["spouse_deduction"]
        remaining = max(spouse_deduction - prior_gifts_spouse, 0)

        # 최적 증여금액: 잔여 공제한도 내
        optimal = min(overseas_stock_value, remaining)

        # 증여 시 증여세 (한도 내이면 0)
        gift_tax = 0  # 잔여 공제 내 증여는 세금 없음

        # 취득가액 승계 효과
        # 증여 시: 배우자 취득가액 = 증여 당시 시가 (증여세 과세가액)
        # 추후 양도 시: 양도차익 감소
        unrealized_gain = overseas_stock_value - overseas_stock_acquisition_cost
        tax_cfg = self._policy["overseas_stock_gains"]
        current_tax_if_sold = max(
            math.floor((unrealized_gain - tax_cfg["basic_deduction"]) * tax_cfg["tax_rate"]), 0
        )

        # 배우자가 증여받은 후 즉시 매도 시: 취득가액 = 시가, 양도세 0
        # (단, 증여 후 1년 이내 매도는 이월과세 적용에 주의)
        acquisition_tax_saving = current_tax_if_sold

        # 상속세 절감 효과 (10년 이전 증여로 상속재산에서 제외)
        # 10년 내 증여는 상속재산에 합산되므로 최소 10년 전 증여 필요
        inh_brackets = self._inh_cfg["brackets"]
        marginal_rate = self._get_marginal_rate(total_assets, inh_brackets)
        inh_saving = math.floor(optimal * marginal_rate)

        total_benefit = acquisition_tax_saving + inh_saving

        return GiftStrategy(
            remaining_spouse_deduction=remaining,
            optimal_gift_amount=optimal,
            tax_saving_vs_inheritance=inh_saving,
            acquisition_cost_tax_saving=acquisition_tax_saving,
            total_benefit=total_benefit,
            recommended_timing=(
                "즉시 증여 권장 — 상속 10년 전 완료 필요"
                if total_assets > 1_000_000_000
                else "배우자 증여 공제 한도 내 활용 검토"
            ),
            notes=[
                f"배우자 증여 잔여 공제: {remaining:,}원",
                f"해외주식 취득가액 승계 절세 효과: {acquisition_tax_saving:,}원",
                f"상속세 절감 효과 (10년 후): {inh_saving:,}원",
                "증여 후 1년 이내 매도 시 이월과세 적용 주의 (양도세 = 원래 취득가 기준)",
                "10년 이전 증여분만 상속재산 합산에서 제외됩니다",
            ],
        )

    def _get_marginal_rate(self, amount: int, brackets: list[dict]) -> float:
        for b in reversed(brackets):
            if amount > b["min"]:
                return b["rate"]
        return 0.0

    def _apply_brackets(self, amount: int, brackets: list[dict]) -> int:
        tax = 0
        for b in brackets:
            lo = b["min"]
            hi = b["max"]
            if amount <= lo:
                break
            if hi is None or amount <= hi:
                tax = math.floor((amount - lo) * b["rate"]) + b["deduction"]
                break
        return max(tax, 0)

    def _generate_reduction_strategies(self, inp: EstateInput, current_tax: int) -> list[str]:
        strategies = []
        if inp.has_spouse:
            strategies.append(
                f"배우자에게 10년 이상 전 6억원 증여 시 상속재산 제외 → 상속세 절감"
            )
        if inp.num_children > 0:
            child_gift = inp.num_children * 50_000_000
            strategies.append(
                f"성인 자녀 {inp.num_children}명에게 {child_gift:,}원 증여 (10년 5천만원 공제)"
            )
        if inp.financial_asset_ratio < 0.5:
            strategies.append(
                "금융자산 비중 증가 시 금융자산 공제(20%, 최대 2억) 활용 가능"
            )
        if current_tax > 100_000_000:
            strategies.append(
                "공익법인 출연, 문화재 물납 등 추가 공제 검토 권장"
            )
        return strategies
