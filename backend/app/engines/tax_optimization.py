"""
세금 최적화 엔진
대한민국 2026년 세법 기준

- 해외주식 양도세
- 금융소득종합과세
- ISA 비과세/분리과세
- 연금저축/IRP 세액공제 및 과세
- 배우자 증여 절세
- 상속세 계산
- 최적 인출 순서 도출
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import math

from app.core.policy_loader import get_policy_loader


@dataclass
class TaxInput:
    # 소득
    employment_income: int = 0
    business_income: int = 0
    financial_income: int = 0          # 이자 + 배당 합산
    overseas_stock_gain: int = 0        # 해외주식 양도차익
    overseas_stock_loss: int = 0        # 해외주식 양도손실 (통산)
    domestic_stock_gain: int = 0        # 국내 대주주 또는 장외주식
    pension_income_public: int = 0      # 국민연금 등
    pension_income_private: int = 0     # 사적연금 (연금저축/IRP)
    rental_income: int = 0
    other_income: int = 0

    # 연령
    age: int = 65

    # ISA
    isa_profit: int = 0                 # ISA 내 수익
    isa_type: str = "general"           # general / low_income / agricultural

    # 연금계좌 기여
    pension_savings_contribution: int = 0
    irp_contribution: int = 0

    # 기타
    pension_income_age: int = 65        # 연금 수령 시작 나이 (세율 결정)
    is_comprehensive_elective: bool = False  # 종합과세 선택 여부


@dataclass
class TaxResult:
    # 소득세
    total_taxable_income: int = 0
    income_tax: int = 0
    local_income_tax: int = 0
    total_income_tax: int = 0

    # 분리과세 세금
    financial_income_withholding: int = 0
    overseas_stock_tax: int = 0
    pension_tax: int = 0
    isa_tax: int = 0

    # 세액공제
    pension_tax_credit: int = 0

    # 총 세금
    total_tax: int = 0
    effective_tax_rate: float = 0.0

    # 최적화 제안
    comprehensive_vs_separate: dict = field(default_factory=dict)
    optimization_suggestions: list[str] = field(default_factory=list)
    alerts: list[str] = field(default_factory=list)


@dataclass
class GiftTaxResult:
    taxable_amount: int
    gift_tax: int
    local_gift_tax: int
    total_gift_tax: int
    effective_rate: float
    remaining_deduction: int
    notes: list[str] = field(default_factory=list)


@dataclass
class InheritanceTaxResult:
    gross_estate: int
    total_deduction: int
    taxable_estate: int
    inheritance_tax: int
    effective_rate: float
    breakdown: dict = field(default_factory=dict)


class TaxOptimizationEngine:
    def __init__(self):
        self._policy = get_policy_loader().tax

    # ── 종합 세금 계산 ─────────────────────────────────────────────────────
    def calculate(self, inp: TaxInput) -> TaxResult:
        result = TaxResult()

        # 1. ISA 과세 (비과세 한도 초과분)
        result.isa_tax = self._calculate_isa_tax(inp)

        # 2. 해외주식 양도세
        result.overseas_stock_tax = self._calculate_overseas_stock_tax(inp)

        # 3. 연금소득세 (분리과세)
        result.pension_tax = self._calculate_pension_tax(inp)

        # 4. 금융소득: 종합과세 vs 분리과세 비교
        fi_comprehensive = self._financial_income_comprehensive(inp)
        fi_separate = self._financial_income_separate(inp)
        result.comprehensive_vs_separate = {
            "financial_income": inp.financial_income,
            "comprehensive_tax": fi_comprehensive,
            "separate_tax": fi_separate,
            "recommended": "분리과세" if fi_separate <= fi_comprehensive else "종합과세",
        }

        # 5. 금융소득 처리 (기본: 분리과세, 2천만원 초과 시 종합)
        if inp.financial_income > 20_000_000:
            result.financial_income_withholding = fi_separate  # 원천징수
        else:
            result.financial_income_withholding = self._withholding_tax(inp.financial_income)

        # 6. 종합소득 계산 (금융소득 2천만원 초과 시 포함)
        comprehensive_income = self._build_comprehensive_income(inp)
        result.total_taxable_income = comprehensive_income
        income_tax = self._calculate_income_tax(comprehensive_income)
        result.income_tax = income_tax
        result.local_income_tax = math.floor(income_tax * 0.10)
        result.total_income_tax = income_tax + result.local_income_tax

        # 7. 연금계좌 세액공제
        result.pension_tax_credit = self._calculate_pension_tax_credit(inp)

        # 8. 총 세금
        result.total_tax = (
            result.total_income_tax
            + result.overseas_stock_tax
            + result.pension_tax
            + result.isa_tax
            - result.pension_tax_credit
        )
        result.total_tax = max(result.total_tax, 0)

        total_income = (
            inp.employment_income + inp.business_income + inp.financial_income
            + inp.overseas_stock_gain + inp.pension_income_public + inp.pension_income_private
            + inp.rental_income + inp.other_income
        )
        if total_income > 0:
            result.effective_tax_rate = round(result.total_tax / total_income, 4)

        result.optimization_suggestions = self._generate_suggestions(inp, result)
        result.alerts = self._generate_alerts(inp)

        return result

    # ── 소득세 구간 계산 ────────────────────────────────────────────────────
    def _calculate_income_tax(self, taxable_income: int) -> int:
        brackets = self._policy["income_tax_brackets"]
        tax = 0
        for bracket in brackets:
            lo = bracket["min"]
            hi = bracket["max"]
            if taxable_income <= lo:
                break
            upper = min(taxable_income, hi) if hi else taxable_income
            tax = math.floor((upper - lo) * bracket["rate"]) + bracket["deduction"]
            if hi is None or taxable_income <= hi:
                break
        return max(tax, 0)

    def _build_comprehensive_income(self, inp: TaxInput) -> int:
        """종합과세 대상 소득 합산 (금융소득 2천만원 초과분 포함)"""
        total = inp.employment_income + inp.business_income + inp.rental_income + inp.other_income

        # 연금소득 (국민연금 — 공제 후)
        pension_deducted = self._pension_income_deduction(inp.pension_income_public)
        total += pension_deducted

        # 금융소득 2천만원 초과 시 초과분 종합과세
        if inp.financial_income > 20_000_000:
            total += inp.financial_income - 20_000_000

        return max(total, 0)

    def _pension_income_deduction(self, pension_income: int) -> int:
        """연금소득공제"""
        brackets = self._policy["pension_income_deduction"]["brackets"]
        max_deduction = self._policy["pension_income_deduction"]["max_deduction"]

        deduction = 0
        monthly = pension_income / 12
        annual = pension_income

        for b in brackets:
            lo = b["min"] * 12  # 월→연 변환
            hi = (b["max"] * 12) if b["max"] else None
            if annual <= lo:
                break
            if hi is None or annual <= hi:
                deduction = (annual - lo) * b["rate"] + b["floor"]
                break

        deduction = min(deduction, max_deduction)
        return max(annual - deduction, 0)

    # ── 분리과세 계산 ────────────────────────────────────────────────────────
    def _withholding_tax(self, financial_income: int) -> int:
        rate = self._policy["financial_income"]["withholding_rate"]
        return math.floor(financial_income * rate)

    def _financial_income_separate(self, inp: TaxInput) -> int:
        return self._withholding_tax(inp.financial_income)

    def _financial_income_comprehensive(self, inp: TaxInput) -> int:
        if inp.financial_income <= 20_000_000:
            return self._withholding_tax(inp.financial_income)
        excess = inp.financial_income - 20_000_000
        base_income = (
            inp.employment_income + inp.business_income
            + inp.rental_income + inp.other_income
        )
        tax_on_base = self._calculate_income_tax(base_income)
        tax_on_full = self._calculate_income_tax(base_income + excess)
        return self._withholding_tax(20_000_000) + (tax_on_full - tax_on_base)

    # ── 해외주식 양도세 ─────────────────────────────────────────────────────
    def _calculate_overseas_stock_tax(self, inp: TaxInput) -> int:
        cfg = self._policy["overseas_stock_gains"]
        net_gain = inp.overseas_stock_gain - inp.overseas_stock_loss
        taxable = max(net_gain - cfg["basic_deduction"], 0)
        return math.floor(taxable * cfg["tax_rate"])

    # ── 연금소득세 ───────────────────────────────────────────────────────────
    def _calculate_pension_tax(self, inp: TaxInput) -> int:
        rates = self._policy["pension_accounts"]["pension_withdrawal_tax"]
        limit = rates["separate_tax_limit"]

        age = inp.pension_income_age
        if age < 70:
            rate = rates["rate_age_55_69"]   # 55~69세: 5.5%
        elif age < 80:
            rate = rates["rate_age_70_79"]   # 70~79세: 4.4%
        else:
            rate = rates["rate_age_80_plus"] # 80세+: 3.3%

        private_pension = inp.pension_income_private
        if private_pension <= limit:
            return math.floor(private_pension * rate)
        else:
            # 한도 초과: 종합과세 or 16.5% 분리과세 중 선택
            tax_within = math.floor(limit * rate)
            tax_excess_separate = math.floor((private_pension - limit) * rates["over_threshold_rate"])
            # 종합과세 비교
            excess_comprehensive = self._calculate_income_tax(
                self._build_comprehensive_income(inp) + (private_pension - limit)
            ) - self._calculate_income_tax(self._build_comprehensive_income(inp))
            tax_excess = min(tax_excess_separate, excess_comprehensive)
            return tax_within + tax_excess

    # ── ISA 세금 ─────────────────────────────────────────────────────────────
    def _calculate_isa_tax(self, inp: TaxInput) -> int:
        isa_cfg = self._policy["isa"]["types"]
        cfg = isa_cfg.get(inp.isa_type, isa_cfg["general"])
        tax_free = cfg["tax_free_limit"]
        rate = cfg["excess_rate"]
        taxable = max(inp.isa_profit - tax_free, 0)
        return math.floor(taxable * rate)

    # ── 연금계좌 세액공제 ─────────────────────────────────────────────────────
    def _calculate_pension_tax_credit(self, inp: TaxInput) -> int:
        pa_cfg = self._policy["pension_accounts"]
        total_income = inp.employment_income + inp.business_income

        if total_income <= 55_000_000:
            rate = pa_cfg["pension_savings"]["tax_credit_rate_below_55m"]
        else:
            rate = pa_cfg["pension_savings"]["tax_credit_rate_above_55m"]

        combined_limit = pa_cfg["irp"]["combined_limit_with_pension"]
        ps_limit = pa_cfg["pension_savings"]["annual_contribution_limit"]

        ps_eligible = min(inp.pension_savings_contribution, ps_limit)
        combined_eligible = min(
            inp.pension_savings_contribution + inp.irp_contribution,
            combined_limit,
        )

        credit_base = min(ps_eligible, pa_cfg["pension_savings"]["tax_credit_limit"])
        credit_base = min(combined_eligible, combined_limit)

        if inp.age >= 50:
            credit_base = min(credit_base + pa_cfg["over_50_additional"], combined_limit + 2_000_000)

        return math.floor(credit_base * rate)

    # ── 증여세 ────────────────────────────────────────────────────────────────
    def calculate_gift_tax(
        self,
        gift_amount: int,
        recipient: str = "spouse",
        prior_gifts_10y: int = 0,
    ) -> GiftTaxResult:
        cfg = self._policy["gift_tax"]

        if recipient == "spouse":
            deduction = cfg["spouse_deduction"]
        elif recipient == "adult_child":
            deduction = cfg["adult_child_deduction"]
        else:
            deduction = cfg["minor_child_deduction"]

        remaining = max(deduction - prior_gifts_10y, 0)
        taxable = max(gift_amount - remaining, 0)
        gift_tax = self._apply_brackets(taxable, cfg["brackets"])
        local_tax = math.floor(gift_tax * 0.10)

        notes = []
        if recipient == "spouse":
            notes.append(f"배우자 증여 공제 {deduction:,}원 (10년 누적)")
            if cfg.get("acquisition_cost_succession"):
                notes.append("취득가액 승계로 향후 양도세 절세 효과")

        return GiftTaxResult(
            taxable_amount=taxable,
            gift_tax=gift_tax,
            local_gift_tax=local_tax,
            total_gift_tax=gift_tax + local_tax,
            effective_rate=round((gift_tax + local_tax) / gift_amount, 4) if gift_amount > 0 else 0,
            remaining_deduction=remaining,
            notes=notes,
        )

    # ── 상속세 ────────────────────────────────────────────────────────────────
    def calculate_inheritance_tax(
        self,
        gross_estate: int,
        has_spouse: bool = True,
        spouse_share: float = 0.5,
        financial_asset_ratio: float = 0.3,
    ) -> InheritanceTaxResult:
        cfg = self._policy["inheritance_tax"]

        # 공제 계산
        basic_deduction = cfg["basic_deduction"]
        lump_sum = cfg["lump_sum_deduction"]

        # 배우자 공제 (실제 상속 지분 × 상속재산, 최소 5억 최대 30억)
        spouse_deduction = 0
        if has_spouse:
            spouse_actual = math.floor(gross_estate * spouse_share)
            spouse_deduction = max(
                min(spouse_actual, cfg["spouse_deduction_max"]),
                cfg["spouse_deduction_min"],
            )

        # 금융자산 공제 (20%, 최대 2억)
        financial_deduction = min(
            math.floor(gross_estate * financial_asset_ratio * 0.20),
            cfg["financial_asset_deduction_max"],
        )

        # 일괄공제 vs 기초+배우자 중 큰 것
        itemized = basic_deduction + spouse_deduction + financial_deduction
        total_deduction = max(itemized, lump_sum + (spouse_deduction if has_spouse else 0))
        total_deduction = min(total_deduction, gross_estate)

        taxable = max(gross_estate - total_deduction, 0)
        inheritance_tax = self._apply_brackets(taxable, cfg["brackets"])

        return InheritanceTaxResult(
            gross_estate=gross_estate,
            total_deduction=total_deduction,
            taxable_estate=taxable,
            inheritance_tax=inheritance_tax,
            effective_rate=round(inheritance_tax / gross_estate, 4) if gross_estate > 0 else 0,
            breakdown={
                "basic_deduction": basic_deduction,
                "spouse_deduction": spouse_deduction,
                "financial_deduction": financial_deduction,
                "lump_sum_deduction": lump_sum,
                "used_method": "일괄공제" if lump_sum > itemized else "개별공제",
            },
        )

    # ── 절세 매도 전략 ────────────────────────────────────────────────────────
    def optimal_selling_strategy(
        self,
        holdings: list[dict],
        target_gain_budget: int = 2_500_000,
    ) -> list[dict]:
        """
        해외주식 절세 매도 전략:
        손실 실현으로 양도차익 상계, 기본공제 250만원 활용
        """
        cfg = self._policy["overseas_stock_gains"]
        basic_deduction = cfg["basic_deduction"]
        suggestions = []

        total_unrealized_gain = sum(h.get("unrealized_gain", 0) for h in holdings if h.get("unrealized_gain", 0) > 0)
        total_unrealized_loss = sum(abs(h.get("unrealized_gain", 0)) for h in holdings if h.get("unrealized_gain", 0) < 0)

        # 기본공제 + 손실 상계 범위 내 매도 가능
        sellable_gain = basic_deduction + total_unrealized_loss

        for h in sorted(holdings, key=lambda x: x.get("unrealized_gain", 0), reverse=True):
            gain = h.get("unrealized_gain", 0)
            if gain > 0 and gain <= sellable_gain:
                suggestions.append({
                    "ticker": h.get("ticker", ""),
                    "action": "매도 권장 (절세)",
                    "unrealized_gain": gain,
                    "tax_if_sold": 0,
                    "reason": f"기본공제/손실 상계 범위 내 — 세금 없이 차익 실현",
                })

        return suggestions

    # ── 최적 인출 순서 ────────────────────────────────────────────────────────
    def optimal_withdrawal_order(
        self,
        annual_need: int,
        financial_income_current: int,
        pension_private_current: int,
        isa_available: int,
        pension_savings_available: int,
        irp_available: int,
        national_pension_monthly: int,
    ) -> dict:
        """건보료 및 종합과세 최소화를 위한 최적 인출 순서 도출"""
        remaining = annual_need
        plan = []
        total_tax = 0

        # 1단계: 국민연금 (강제)
        np_annual = national_pension_monthly * 12
        plan.append({"source": "국민연금", "amount": np_annual, "tax": 0, "note": "자동 지급"})
        remaining -= np_annual

        # 2단계: ISA 비과세 인출
        if remaining > 0 and isa_available > 0:
            withdraw = min(remaining, isa_available)
            plan.append({"source": "ISA", "amount": withdraw, "tax": 0, "note": "비과세 인출"})
            remaining -= withdraw

        # 3단계: 금융소득 2천만원 이하 유지하면서 인출
        fi_headroom = max(20_000_000 - financial_income_current, 0)
        if remaining > 0 and fi_headroom > 0:
            withdraw = min(remaining, fi_headroom)
            tax = self._withholding_tax(withdraw)
            plan.append({"source": "금융자산", "amount": withdraw, "tax": tax, "note": "금융소득 한도 내"})
            remaining -= withdraw
            total_tax += tax

        # 4단계: 사적연금 분리과세 한도 (1,500만원) 내
        pension_headroom = max(15_000_000 - pension_private_current, 0)
        if remaining > 0 and pension_savings_available > 0:
            withdraw = min(remaining, min(pension_headroom, pension_savings_available))
            tax = math.floor(withdraw * 0.044)  # 60~69세 기준
            plan.append({"source": "연금저축", "amount": withdraw, "tax": tax, "note": "분리과세 한도 내"})
            remaining -= withdraw
            total_tax += tax

        if remaining > 0 and irp_available > 0:
            withdraw = min(remaining, max(pension_headroom - min(pension_headroom, pension_savings_available), 0), irp_available)
            if withdraw > 0:
                tax = math.floor(withdraw * 0.044)
                plan.append({"source": "IRP", "amount": withdraw, "tax": tax, "note": "분리과세 한도 내"})
                remaining -= withdraw
                total_tax += tax

        if remaining > 0:
            plan.append({"source": "추가 필요", "amount": remaining, "tax": None, "note": "자산 점검 필요"})

        return {"plan": plan, "total_tax": total_tax, "unmet": max(remaining, 0)}

    # ── 내부 헬퍼 ─────────────────────────────────────────────────────────────
    def _apply_brackets(self, amount: int, brackets: list[dict]) -> int:
        tax = 0
        for b in brackets:
            lo = b["min"]
            hi = b["max"]
            rate = b["rate"]
            ded = b["deduction"]
            if amount <= lo:
                break
            if hi is None or amount <= hi:
                tax = math.floor((amount - lo) * rate) + ded
                break
        return max(tax, 0)

    def _generate_suggestions(self, inp: TaxInput, result: TaxResult) -> list[str]:
        suggestions = []
        if inp.financial_income > 18_000_000:
            suggestions.append(
                f"금융소득 {inp.financial_income:,}원 — ISA로 이전 시 비과세 혜택 가능"
            )
        if inp.pension_income_private > 15_000_000:
            suggestions.append(
                "사적연금이 분리과세 한도(1,500만원) 초과 — 인출 시기 분산 권장"
            )
        if inp.overseas_stock_gain > 2_500_000:
            suggestions.append(
                f"해외주식 양도차익 {inp.overseas_stock_gain:,}원 — 손실 종목 정리로 세금 절감 가능"
            )
        if inp.pension_savings_contribution + inp.irp_contribution < 9_000_000:
            suggestions.append(
                "연금저축+IRP 세액공제 한도 미달 — 추가 납입으로 절세 가능"
            )
        return suggestions

    def _generate_alerts(self, inp: TaxInput) -> list[str]:
        alerts = []
        if inp.financial_income >= 20_000_000:
            alerts.append("⚠️ 금융소득 2천만원 초과 — 금융소득종합과세 대상")
        if inp.pension_income_private > 15_000_000:
            alerts.append("⚠️ 사적연금 1,500만원 초과 — 종합과세 여부 검토 필요")
        return alerts
