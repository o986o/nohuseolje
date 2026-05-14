"""
시뮬레이션 API 라우터
현금흐름 / 건보료 / 세금 / 몬테카를로 / 연금 최적화 / 상속증여
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID, uuid4
import asyncio
from functools import partial

from app.db.database import get_db
from app.schemas.simulation import (
    CashflowSimRequest, CashflowSimResponse, YearlyCashflowResponse,
    HealthInsuranceRequest, HealthInsuranceResponse,
    TaxCalculationRequest, TaxCalculationResponse,
    MonteCarloRequest, MonteCarloResponse,
    GiftTaxRequest, InheritanceTaxRequest,
    PensionOptimizeRequest,
)
from app.engines.health_insurance import HealthInsuranceEngine, HealthInsuranceInput, SubscriberType
from app.engines.tax_optimization import TaxOptimizationEngine, TaxInput
from app.engines.monte_carlo import MonteCarloEngine, MonteCarloInput
from app.engines.cashflow import CashflowEngine, CashflowProfile
from app.engines.pension_withdrawal import PensionWithdrawalEngine, PensionWithdrawalInput
from app.engines.estate_gift_tax import EstateGiftTaxEngine, EstateInput

router = APIRouter(prefix="/simulation", tags=["simulation"])

# ── 현금흐름 시뮬레이션 ──────────────────────────────────────────────────────
@router.post("/cashflow", response_model=CashflowSimResponse)
async def run_cashflow_simulation(
    req: CashflowSimRequest,
    db: AsyncSession = Depends(get_db),
):
    """100세까지 연도별 현금흐름 시뮬레이션"""
    # TODO: 저장된 프로파일 로드
    # 임시: 기본 프로파일 사용 (실제 구현에서는 profile_id로 DB 조회)
    raise HTTPException(status_code=501, detail="프로파일 ID를 통한 조회 구현 예정")


@router.post("/cashflow/quick")
async def quick_cashflow(profile: dict):
    """프로파일 직접 입력으로 빠른 시뮬레이션"""
    engine = CashflowEngine()
    cf_profile = CashflowProfile(**{
        k: v for k, v in profile.items()
        if k in CashflowProfile.__dataclass_fields__
    })
    loop = asyncio.get_event_loop()
    cashflows = await loop.run_in_executor(None, engine.project, cf_profile)
    summary = engine.summary(cashflows)

    return {
        "simulation_id": str(uuid4()),
        "yearly_data": [cf.__dict__ for cf in cashflows],
        "summary": summary,
    }


# ── 건보료 계산 ──────────────────────────────────────────────────────────────
@router.post("/health-insurance", response_model=HealthInsuranceResponse)
async def calculate_health_insurance(req: HealthInsuranceRequest):
    """건강보험료 계산 (2026년 기준)"""
    engine = HealthInsuranceEngine()
    inp = HealthInsuranceInput(
        subscriber_type=SubscriberType(req.subscriber_type),
        employment_income=req.employment_income,
        financial_income=req.financial_income,
        pension_income_public=req.pension_income_public,
        pension_income_private=req.pension_income_private,
        rental_income=req.rental_income,
        other_income=req.other_income,
        real_estate_assessed=req.real_estate_assessed,
        vehicle_value=req.vehicle_value,
        vehicle_displacement_cc=req.vehicle_displacement_cc,
        vehicle_age_years=req.vehicle_age_years,
        is_dependent_candidate=req.is_dependent_candidate,
    )
    result = engine.calculate(inp)
    return HealthInsuranceResponse(**result.__dict__)


@router.post("/health-insurance/projection")
async def project_health_insurance(
    req: HealthInsuranceRequest,
    years: int = 20,
    inflation_rate: float = 0.025,
):
    """연도별 건보료 예측"""
    engine = HealthInsuranceEngine()
    inp = HealthInsuranceInput(
        subscriber_type=SubscriberType(req.subscriber_type),
        employment_income=req.employment_income,
        financial_income=req.financial_income,
        pension_income_public=req.pension_income_public,
        pension_income_private=req.pension_income_private,
        rental_income=req.rental_income,
        other_income=req.other_income,
        real_estate_assessed=req.real_estate_assessed,
        vehicle_value=req.vehicle_value,
        vehicle_displacement_cc=req.vehicle_displacement_cc,
        vehicle_age_years=req.vehicle_age_years,
    )
    results = engine.project_premium_years(inp, years, inflation_rate)
    return [r.__dict__ for r in results]


# ── 세금 계산 ─────────────────────────────────────────────────────────────────
@router.post("/tax", response_model=TaxCalculationResponse)
async def calculate_tax(req: TaxCalculationRequest):
    """세금 계산 및 최적화 (2026년 기준)"""
    engine = TaxOptimizationEngine()
    inp = TaxInput(
        employment_income=req.employment_income,
        financial_income=req.financial_income,
        overseas_stock_gain=req.overseas_stock_gain,
        overseas_stock_loss=req.overseas_stock_loss,
        pension_income_public=req.pension_income_public,
        pension_income_private=req.pension_income_private,
        rental_income=req.rental_income,
        isa_profit=req.isa_profit,
        isa_type=req.isa_type,
        pension_savings_contribution=req.pension_savings_contribution,
        irp_contribution=req.irp_contribution,
        age=req.age,
        pension_income_age=req.pension_income_age,
    )
    result = engine.calculate(inp)
    return TaxCalculationResponse(**result.__dict__)


@router.post("/tax/withdrawal-order")
async def optimal_withdrawal_order(
    annual_need: int,
    financial_income_current: int = 0,
    pension_private_current: int = 0,
    isa_available: int = 0,
    pension_savings_available: int = 0,
    irp_available: int = 0,
    national_pension_monthly: int = 0,
):
    """최적 인출 순서 계산"""
    engine = TaxOptimizationEngine()
    return engine.optimal_withdrawal_order(
        annual_need=annual_need,
        financial_income_current=financial_income_current,
        pension_private_current=pension_private_current,
        isa_available=isa_available,
        pension_savings_available=pension_savings_available,
        irp_available=irp_available,
        national_pension_monthly=national_pension_monthly,
    )


# ── 몬테카를로 ──────────────────────────────────────────────────────────────
@router.post("/monte-carlo", response_model=MonteCarloResponse)
async def run_monte_carlo(req: MonteCarloRequest):
    """몬테카를로 시뮬레이션 (Fat Tail / Regime Switching)"""
    engine = MonteCarloEngine()
    inp = MonteCarloInput(
        asset_allocation=req.asset_allocation,
        initial_portfolio=req.initial_portfolio,
        annual_withdrawal=req.annual_withdrawal,
        annual_income=req.annual_income,
        withdrawal_inflation_rate=req.withdrawal_inflation_rate,
        current_age=req.current_age,
        target_age=req.target_age,
        num_simulations=req.num_simulations,
        withdrawal_strategy=req.withdrawal_strategy,
        use_fat_tail=req.use_fat_tail,
        use_regime_switching=req.use_regime_switching,
    )

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, engine.run, inp)
    return MonteCarloResponse(**result.__dict__)


@router.post("/monte-carlo/stress-test")
async def stress_test(req: MonteCarloRequest):
    """스트레스 테스트 (글로벌 위기 / 고인플레이션 / 장기침체)"""
    engine = MonteCarloEngine()
    inp = MonteCarloInput(
        asset_allocation=req.asset_allocation,
        initial_portfolio=req.initial_portfolio,
        annual_withdrawal=req.annual_withdrawal,
        annual_income=req.annual_income,
        current_age=req.current_age,
        target_age=req.target_age,
        num_simulations=min(req.num_simulations, 5000),
    )
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, engine.stress_test, inp)
    return {k: v.__dict__ for k, v in results.items()}


@router.post("/monte-carlo/compare-strategies")
async def compare_withdrawal_strategies(req: MonteCarloRequest):
    """인출 전략 비교 (Fixed / Guardrails / VPW / Floor-Ceiling)"""
    engine = MonteCarloEngine()
    inp = MonteCarloInput(
        asset_allocation=req.asset_allocation,
        initial_portfolio=req.initial_portfolio,
        annual_withdrawal=req.annual_withdrawal,
        annual_income=req.annual_income,
        current_age=req.current_age,
        target_age=req.target_age,
        num_simulations=min(req.num_simulations, 5000),
    )
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, engine.compare_withdrawal_strategies, inp)
    return {k: v.__dict__ for k, v in results.items()}


# ── 연금 최적화 ──────────────────────────────────────────────────────────────
@router.post("/pension/optimize")
async def optimize_pension(req: PensionOptimizeRequest):
    """연금 개시 시점 및 인출 전략 최적화"""
    engine = PensionWithdrawalEngine()
    inp = PensionWithdrawalInput(
        current_age=req.current_age,
        pension_savings_balance=req.pension_savings_balance,
        irp_balance=req.irp_balance,
        isa_balance=req.isa_balance,
        national_pension_monthly=req.national_pension_monthly,
        other_annual_income=req.other_annual_income,
        financial_income=req.financial_income,
        target_monthly_expense=req.target_monthly_expense,
        planned_start_age=req.planned_start_age,
    )
    result = engine.optimize(inp)
    return {
        "plans": [p.__dict__ for p in result.plans],
        "recommended_start_age": result.recommended_start_age,
        "recommended_strategy": result.recommended_strategy,
        "isa_transfer_benefit": result.isa_transfer_benefit,
        "optimization_summary": result.optimization_summary,
    }


# ── 증여/상속세 ──────────────────────────────────────────────────────────────
@router.post("/gift-tax")
async def calculate_gift_tax(req: GiftTaxRequest):
    """증여세 계산"""
    engine = EstateGiftTaxEngine()
    result = engine.calculate_gift_tax(
        gift_amount=req.gift_amount,
        recipient=req.recipient,
        prior_gifts_10y=req.prior_gifts_10y,
    )
    return result.__dict__


@router.post("/inheritance-tax")
async def calculate_inheritance_tax(req: InheritanceTaxRequest):
    """상속세 계산"""
    engine = EstateGiftTaxEngine()
    inp = EstateInput(
        total_assets=req.gross_estate,
        has_spouse=req.has_spouse,
        spouse_share=req.spouse_share,
        financial_asset_ratio=req.financial_asset_ratio,
    )
    result = engine.calculate_estate(inp)
    return result.__dict__


@router.post("/gift-strategy")
async def analyze_gift_strategy(
    total_assets: int,
    overseas_stock_value: int,
    overseas_stock_acquisition_cost: int,
    prior_gifts_spouse: int = 0,
):
    """배우자 증여 절세 전략 분석"""
    engine = EstateGiftTaxEngine()
    result = engine.calculate_gift_strategy(
        total_assets=total_assets,
        overseas_stock_value=overseas_stock_value,
        overseas_stock_acquisition_cost=overseas_stock_acquisition_cost,
        prior_gifts_spouse=prior_gifts_spouse,
    )
    return result.__dict__
