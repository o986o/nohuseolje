"""
API 요청/응답 스키마 (Pydantic v2)
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from uuid import UUID


# ── 온보딩 / 프로파일 ────────────────────────────────────────────────────────
class UserProfileCreate(BaseModel):
    birth_year: int = Field(..., ge=1930, le=2000)
    birth_month: Optional[int] = Field(None, ge=1, le=12)
    gender: Literal["male", "female"]
    retirement_age: int = Field(65, ge=50, le=80)
    target_death_age: int = Field(100, ge=80, le=110)

    residence_type: Literal["employee", "regional"] = "regional"
    has_spouse: bool = False
    spouse_birth_year: Optional[int] = None
    spouse_gender: Optional[Literal["male", "female"]] = None
    spouse_income_monthly: int = Field(0, ge=0)
    dependents_count: int = Field(0, ge=0, le=10)

    employment_status: Literal["employed", "self_employed", "retired"] = "employed"
    monthly_salary: int = Field(0, ge=0)
    business_income_annual: int = Field(0, ge=0)
    other_income_annual: int = Field(0, ge=0)

    total_financial_assets: int = Field(0, ge=0)
    domestic_stock: int = Field(0, ge=0)
    us_stock: int = Field(0, ge=0)
    other_overseas_stock: int = Field(0, ge=0)
    bonds: int = Field(0, ge=0)
    cash_deposits: int = Field(0, ge=0)
    real_estate_value: int = Field(0, ge=0)
    real_estate_loan: int = Field(0, ge=0)
    other_assets: int = Field(0, ge=0)

    national_pension_monthly: int = Field(0, ge=0)
    pension_savings_balance: int = Field(0, ge=0)
    irp_balance: int = Field(0, ge=0)
    isa_balance: int = Field(0, ge=0)
    company_pension_balance: int = Field(0, ge=0)
    pension_start_age: int = Field(65, ge=55, le=75)

    monthly_living_expense: int = Field(0, ge=0)
    monthly_medical_expense: int = Field(0, ge=0)
    monthly_housing_expense: int = Field(0, ge=0)
    target_monthly_expense: int = Field(0, ge=0)
    risk_tolerance: Literal["conservative", "moderate", "aggressive"] = "moderate"


class UserProfileResponse(UserProfileCreate):
    id: UUID
    user_id: UUID

    class Config:
        from_attributes = True


# ── 현금흐름 시뮬레이션 ──────────────────────────────────────────────────────
class CashflowSimRequest(BaseModel):
    profile_id: Optional[UUID] = None
    inflation_rate: float = Field(0.025, ge=0.0, le=0.20)
    medical_inflation_rate: float = Field(0.04, ge=0.0, le=0.20)
    us_stock_return: float = Field(0.085, ge=-0.20, le=0.30)
    target_age: int = Field(100, ge=80, le=110)
    scenario_name: Optional[str] = None


class YearlyCashflowResponse(BaseModel):
    year: int
    age: int
    total_income: int
    total_expense: int
    net_cashflow: int
    total_assets: int
    national_pension: int
    private_pension: int
    financial_income: int
    health_insurance: int
    ltc_insurance: int
    long_term_care_cost: int
    total_tax: int
    alerts: list[str]
    is_cashflow_negative: bool
    is_assets_depleted: bool


class CashflowSimResponse(BaseModel):
    simulation_id: UUID
    yearly_data: list[YearlyCashflowResponse]
    summary: dict


# ── 건보료 계산 ──────────────────────────────────────────────────────────────
class HealthInsuranceRequest(BaseModel):
    subscriber_type: Literal["employee", "regional", "dependent"]
    employment_income: int = Field(0, ge=0)
    financial_income: int = Field(0, ge=0)
    pension_income_public: int = Field(0, ge=0)
    pension_income_private: int = Field(0, ge=0)
    rental_income: int = Field(0, ge=0)
    other_income: int = Field(0, ge=0)
    real_estate_assessed: int = Field(0, ge=0)
    vehicle_value: int = Field(0, ge=0)
    vehicle_displacement_cc: int = Field(0, ge=0)
    vehicle_age_years: int = Field(0, ge=0)
    is_dependent_candidate: bool = False


class HealthInsuranceResponse(BaseModel):
    subscriber_type: str
    monthly_premium: int
    annual_premium: int
    ltc_premium_monthly: int
    total_monthly: int
    total_annual: int
    income_premium: int = 0
    property_premium: int = 0
    vehicle_premium: int = 0
    is_dependent_eligible: bool = False
    dependent_disqualification_reasons: list[str] = []
    dependency_risk_score: float = 0.0
    alerts: list[str] = []


# ── 세금 계산 ─────────────────────────────────────────────────────────────────
class TaxCalculationRequest(BaseModel):
    employment_income: int = Field(0, ge=0)
    financial_income: int = Field(0, ge=0)
    overseas_stock_gain: int = Field(0, ge=0)
    overseas_stock_loss: int = Field(0, ge=0)
    pension_income_public: int = Field(0, ge=0)
    pension_income_private: int = Field(0, ge=0)
    rental_income: int = Field(0, ge=0)
    isa_profit: int = Field(0, ge=0)
    isa_type: Literal["general", "low_income", "agricultural"] = "general"
    pension_savings_contribution: int = Field(0, ge=0)
    irp_contribution: int = Field(0, ge=0)
    age: int = Field(65, ge=55, le=100)
    pension_income_age: int = Field(65, ge=55, le=100)


class TaxCalculationResponse(BaseModel):
    total_taxable_income: int
    income_tax: int
    local_income_tax: int
    total_income_tax: int
    financial_income_withholding: int
    overseas_stock_tax: int
    pension_tax: int
    isa_tax: int
    pension_tax_credit: int
    total_tax: int
    effective_tax_rate: float
    comprehensive_vs_separate: dict
    optimization_suggestions: list[str]
    alerts: list[str]


# ── 몬테카를로 ──────────────────────────────────────────────────────────────
class MonteCarloRequest(BaseModel):
    asset_allocation: dict[str, float] = Field(
        default_factory=lambda: {
            "us_stock": 0.40, "kr_stock": 0.10, "bond": 0.30,
            "cash": 0.10, "reits": 0.10
        }
    )
    initial_portfolio: float = Field(..., gt=0)
    annual_withdrawal: float = Field(..., gt=0)
    annual_income: float = Field(0, ge=0)
    withdrawal_inflation_rate: float = Field(0.025, ge=0, le=0.20)
    current_age: int = Field(65, ge=50, le=85)
    target_age: int = Field(100, ge=80, le=110)
    num_simulations: int = Field(10000, ge=1000, le=50000)
    withdrawal_strategy: Literal["fixed", "guardrails", "vpw", "floor_ceiling"] = "fixed"
    use_fat_tail: bool = True
    use_regime_switching: bool = True

    @field_validator("asset_allocation")
    @classmethod
    def validate_allocation(cls, v: dict) -> dict:
        total = sum(v.values())
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"자산 배분 합계가 1.0이어야 합니다 (현재: {total:.3f})")
        return v


class MonteCarloResponse(BaseModel):
    num_simulations: int
    years: int
    survival_prob_target_age: float
    survival_prob_90: float
    survival_prob_95: float
    survival_prob_100: float
    depletion_probability: float
    median_depletion_age: Optional[float]
    expected_depletion_age: Optional[float]
    percentiles_by_age: dict[int, dict[str, float]]
    final_assets_p10: float
    final_assets_p25: float
    final_assets_p50: float
    final_assets_p75: float
    final_assets_p90: float
    median_annual_withdrawal: float
    min_annual_withdrawal: float


# ── 증여/상속세 ──────────────────────────────────────────────────────────────
class GiftTaxRequest(BaseModel):
    gift_amount: int = Field(..., gt=0)
    recipient: Literal["spouse", "adult_child", "minor_child"] = "spouse"
    prior_gifts_10y: int = Field(0, ge=0)


class InheritanceTaxRequest(BaseModel):
    gross_estate: int = Field(..., gt=0)
    has_spouse: bool = True
    spouse_share: float = Field(0.5, ge=0, le=1.0)
    financial_asset_ratio: float = Field(0.3, ge=0, le=1.0)


# ── 연금 최적화 ──────────────────────────────────────────────────────────────
class PensionOptimizeRequest(BaseModel):
    current_age: int = Field(..., ge=50, le=80)
    pension_savings_balance: int = Field(0, ge=0)
    irp_balance: int = Field(0, ge=0)
    isa_balance: int = Field(0, ge=0)
    national_pension_monthly: int = Field(0, ge=0)
    other_annual_income: int = Field(0, ge=0)
    financial_income: int = Field(0, ge=0)
    target_monthly_expense: int = Field(3_000_000, ge=0)
    planned_start_age: int = Field(65, ge=55, le=75)
