"""
현금흐름 엔진 — 100세까지 연도별 현금흐름 시뮬레이션
세금/건보료/연금/인플레이션/의료비 통합 계산
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import math

from app.core.policy_loader import get_policy_loader
from app.engines.health_insurance import HealthInsuranceEngine, HealthInsuranceInput, SubscriberType
from app.engines.tax_optimization import TaxOptimizationEngine, TaxInput


@dataclass
class CashflowProfile:
    # 기본
    current_age: int
    target_age: int = 100
    gender: str = "male"

    # 소득
    monthly_salary: int = 0
    business_income_annual: int = 0
    national_pension_monthly: int = 0
    pension_start_age: int = 65
    retirement_age: int = 65

    # 연금 계좌 잔액
    pension_savings_balance: int = 0
    irp_balance: int = 0
    isa_balance: int = 0

    # 연금 월 수령액 (사적연금)
    private_pension_monthly: int = 0
    private_pension_start_age: int = 65

    # 금융자산 (비연금)
    financial_assets: int = 0
    financial_income_yield: float = 0.03  # 연 수익률

    # 부동산
    real_estate_value: int = 0
    real_estate_loan: int = 0
    rental_income_monthly: int = 0

    # 해외주식
    us_stock_value: int = 0
    us_stock_return: float = 0.085

    # 지출
    monthly_living_expense: int = 0
    monthly_medical_expense: int = 0
    monthly_housing_expense: int = 0

    # 거시경제
    inflation_rate: float = 0.025
    medical_inflation_rate: float = 0.040

    # 건보료
    subscriber_type: str = "regional"
    real_estate_assessed: int = 0

    # 배우자
    has_spouse: bool = False
    spouse_age: int = 0
    spouse_national_pension_monthly: int = 0


@dataclass
class YearlyCashflow:
    year: int
    age: int

    # 수입
    salary_income: int = 0
    national_pension: int = 0
    private_pension: int = 0
    financial_income: int = 0
    rental_income: int = 0
    us_stock_income: int = 0
    other_income: int = 0
    total_income: int = 0

    # 지출
    living_expense: int = 0
    medical_expense: int = 0
    housing_expense: int = 0
    income_tax: int = 0
    health_insurance: int = 0
    ltc_insurance: int = 0
    long_term_care_cost: int = 0
    total_expense: int = 0

    # 자산
    financial_assets: int = 0
    real_estate_value: int = 0
    pension_savings: int = 0
    irp: int = 0
    isa: int = 0
    us_stock: int = 0
    total_assets: int = 0

    # 순현금흐름
    net_cashflow: int = 0

    # 세금 상세
    total_tax: int = 0
    pension_tax: int = 0
    financial_income_tax: int = 0
    overseas_stock_tax: int = 0

    # 경고
    alerts: list[str] = field(default_factory=list)
    is_cashflow_negative: bool = False
    is_assets_depleted: bool = False


class CashflowEngine:
    def __init__(self):
        self._policy = get_policy_loader()
        self._macro = self._policy.macro
        self._hi_engine = HealthInsuranceEngine()
        self._tax_engine = TaxOptimizationEngine()

    def project(self, profile: CashflowProfile) -> list[YearlyCashflow]:
        """100세까지 연도별 현금흐름 계산"""
        results = []

        # 상태 변수 (연도별 변화)
        financial_assets = float(profile.financial_assets)
        pension_savings = float(profile.pension_savings_balance)
        irp = float(profile.irp_balance)
        isa = float(profile.isa_balance)
        us_stock = float(profile.us_stock_value)
        real_estate = float(profile.real_estate_value)

        ltc_cost_data = self._macro["medical_costs"]["long_term_care"]
        ltc_probs = {
            75: ltc_cost_data["probability_need_age_75"],
            80: ltc_cost_data["probability_need_age_80"],
            85: ltc_cost_data["probability_need_age_85"],
            90: ltc_cost_data["probability_need_age_90"],
        }

        for year_offset in range(profile.target_age - profile.current_age + 1):
            age = profile.current_age + year_offset
            year = 2026 + year_offset
            is_retired = age >= profile.retirement_age

            inf_factor = (1 + profile.inflation_rate) ** year_offset
            med_inf_factor = (1 + profile.medical_inflation_rate) ** year_offset

            # ── 수입 계산 ──────────────────────────────────────────────────
            salary = 0 if is_retired else profile.monthly_salary * 12
            national_pension = (
                profile.national_pension_monthly * 12
                if age >= profile.pension_start_age
                else 0
            )
            # 국민연금 물가 연동
            national_pension = int(national_pension * (1 + profile.inflation_rate) ** max(year_offset - max(profile.pension_start_age - profile.current_age, 0), 0))

            private_pension = (
                profile.private_pension_monthly * 12
                if age >= profile.private_pension_start_age
                else 0
            )

            financial_income = int(financial_assets * profile.financial_income_yield)
            rental_income = profile.rental_income_monthly * 12
            us_stock_income = 0  # 미실현 (자산만 증가)

            total_income = salary + national_pension + private_pension + financial_income + rental_income

            # ── 세금 계산 ──────────────────────────────────────────────────
            tax_inp = TaxInput(
                employment_income=salary,
                financial_income=financial_income,
                pension_income_public=national_pension,
                pension_income_private=private_pension,
                rental_income=rental_income,
                age=age,
                pension_income_age=max(age, profile.private_pension_start_age),
            )
            tax_result = self._tax_engine.calculate(tax_inp)
            total_tax = tax_result.total_tax

            # ── 건보료 계산 ──────────────────────────────────────────────
            sub_type = SubscriberType.EMPLOYEE if not is_retired else SubscriberType.REGIONAL
            hi_inp = HealthInsuranceInput(
                subscriber_type=sub_type,
                employment_income=salary,
                financial_income=financial_income,
                pension_income_public=national_pension,
                pension_income_private=private_pension,
                rental_income=rental_income,
                real_estate_assessed=profile.real_estate_assessed,
            )
            hi_result = self._hi_engine.calculate(hi_inp)
            health_insurance = hi_result.monthly_premium * 12
            ltc_insurance = hi_result.ltc_premium_monthly * 12

            # ── 지출 계산 ──────────────────────────────────────────────────
            living = int(profile.monthly_living_expense * 12 * inf_factor)
            medical = int(profile.monthly_medical_expense * 12 * med_inf_factor)
            housing = int(profile.monthly_housing_expense * 12 * inf_factor)

            # 장기요양 비용 (확률 기반 기댓값)
            ltc_prob = 0.0
            for threshold_age, prob in sorted(ltc_probs.items()):
                if age >= threshold_age:
                    ltc_prob = prob
            ltc_cost = 0
            if ltc_prob > 0:
                ltc_grade2_monthly = ltc_cost_data["grade_2_monthly"]
                ltc_cost = int(ltc_grade2_monthly * 12 * ltc_prob * med_inf_factor)

            total_expense = (
                living + medical + housing
                + total_tax + health_insurance + ltc_insurance + ltc_cost
            )

            # ── 순현금흐름 ────────────────────────────────────────────────
            net = total_income - total_expense

            # ── 자산 업데이트 ────────────────────────────────────────────
            new_fa = financial_assets + net
            if new_fa < 0:
                # 부족분을 순서대로 인출: ISA → 연금저축 → IRP → 해외주식
                shortage = abs(new_fa)
                financial_assets = 0

                if isa >= shortage:
                    isa -= shortage
                    shortage = 0
                else:
                    shortage -= isa
                    isa = 0

                if pension_savings >= shortage:
                    pension_savings -= shortage
                    shortage = 0
                else:
                    shortage -= pension_savings
                    pension_savings = 0

                if irp >= shortage:
                    irp -= shortage
                    shortage = 0
                else:
                    shortage -= irp
                    irp = 0

                if us_stock >= shortage:
                    us_stock -= shortage
                    shortage = 0
                else:
                    shortage -= us_stock
                    us_stock = 0
            else:
                financial_assets = new_fa

            # 자산 성장 (남은 잔액에 적용)
            pension_savings *= (1 + 0.04)  # 연금저축 운용 수익
            irp *= (1 + 0.04)
            us_stock *= (1 + profile.us_stock_return)
            real_estate *= (1 + 0.03)      # 부동산 연 3% 상승

            total_assets = (
                int(financial_assets) + int(real_estate) - profile.real_estate_loan
                + int(pension_savings) + int(irp) + int(isa) + int(us_stock)
            )

            alerts = hi_result.alerts + tax_result.alerts
            if net < 0:
                alerts.append(f"⚠️ {age}세: 현금흐름 적자 {abs(net):,}원")

            row = YearlyCashflow(
                year=year,
                age=age,
                salary_income=salary,
                national_pension=national_pension,
                private_pension=private_pension,
                financial_income=financial_income,
                rental_income=rental_income,
                total_income=total_income,
                living_expense=living,
                medical_expense=medical,
                housing_expense=housing,
                income_tax=tax_result.total_income_tax,
                health_insurance=health_insurance,
                ltc_insurance=ltc_insurance,
                long_term_care_cost=ltc_cost,
                total_expense=total_expense,
                financial_assets=int(financial_assets),
                real_estate_value=int(real_estate),
                pension_savings=int(pension_savings),
                irp=int(irp),
                isa=int(isa),
                us_stock=int(us_stock),
                total_assets=max(total_assets, 0),
                net_cashflow=net,
                total_tax=total_tax,
                pension_tax=tax_result.pension_tax,
                financial_income_tax=tax_result.financial_income_withholding,
                overseas_stock_tax=tax_result.overseas_stock_tax,
                alerts=alerts,
                is_cashflow_negative=net < 0,
                is_assets_depleted=total_assets <= 0,
            )
            results.append(row)

            if total_assets <= 0:
                break

        return results

    def summary(self, cashflows: list[YearlyCashflow]) -> dict:
        """현금흐름 요약 통계"""
        if not cashflows:
            return {}

        total_income = sum(c.total_income for c in cashflows)
        total_tax = sum(c.total_tax for c in cashflows)
        total_health = sum(c.health_insurance + c.ltc_insurance for c in cashflows)
        total_expense = sum(c.total_expense for c in cashflows)

        depletion_age = None
        for c in cashflows:
            if c.is_assets_depleted:
                depletion_age = c.age
                break

        negative_cashflow_ages = [c.age for c in cashflows if c.is_cashflow_negative]

        return {
            "depletion_age": depletion_age,
            "survived_to_age": cashflows[-1].age if not depletion_age else depletion_age - 1,
            "total_lifetime_income": total_income,
            "total_lifetime_tax": total_tax,
            "total_lifetime_health_insurance": total_health,
            "total_lifetime_expense": total_expense,
            "peak_assets_age": max(cashflows, key=lambda c: c.total_assets).age,
            "peak_assets": max(c.total_assets for c in cashflows),
            "final_assets": cashflows[-1].total_assets,
            "negative_cashflow_years": len(negative_cashflow_ages),
            "first_negative_age": negative_cashflow_ages[0] if negative_cashflow_ages else None,
            "avg_annual_tax": int(total_tax / len(cashflows)),
            "avg_annual_health_insurance": int(total_health / len(cashflows)),
        }
