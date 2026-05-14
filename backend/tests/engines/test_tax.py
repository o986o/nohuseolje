"""
세금 최적화 엔진 단위 테스트
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.engines.tax_optimization import TaxOptimizationEngine, TaxInput


@pytest.fixture
def engine():
    return TaxOptimizationEngine()


class TestOverseasStockTax:
    def test_basic_deduction(self, engine):
        inp = TaxInput(overseas_stock_gain=2_000_000)
        result = engine.calculate(inp)
        # 2백만 < 250만 기본공제 → 세금 0
        assert result.overseas_stock_tax == 0

    def test_over_basic_deduction(self, engine):
        inp = TaxInput(overseas_stock_gain=10_000_000)
        result = engine.calculate(inp)
        # (1천만 - 250만) × 22% = 165만
        assert result.overseas_stock_tax == 1_650_000

    def test_loss_offset(self, engine):
        inp = TaxInput(overseas_stock_gain=10_000_000, overseas_stock_loss=5_000_000)
        result = engine.calculate(inp)
        # 순이익 500만 - 250만 = 250만 × 22% = 55만
        assert result.overseas_stock_tax == 550_000


class TestISATax:
    def test_within_tax_free(self, engine):
        inp = TaxInput(isa_profit=1_500_000, isa_type="general")
        result = engine.calculate(inp)
        # 150만 < 200만 비과세 → 세금 0
        assert result.isa_tax == 0

    def test_excess_tax(self, engine):
        inp = TaxInput(isa_profit=5_000_000, isa_type="general")
        result = engine.calculate(inp)
        # (500만 - 200만) × 9.9% = 297,000
        assert result.isa_tax == 297_000

    def test_low_income_higher_exempt(self, engine):
        inp = TaxInput(isa_profit=3_500_000, isa_type="low_income")
        result = engine.calculate(inp)
        # 350만 < 400만 비과세 → 세금 0
        assert result.isa_tax == 0


class TestPensionTaxCredit:
    def test_pension_savings_credit(self, engine):
        inp = TaxInput(pension_savings_contribution=4_000_000, employment_income=40_000_000)
        result = engine.calculate(inp)
        # 400만 × 16.5% = 660,000
        assert result.pension_tax_credit == 660_000

    def test_combined_limit(self, engine):
        inp = TaxInput(
            pension_savings_contribution=6_000_000,
            irp_contribution=5_000_000,
            employment_income=40_000_000,
        )
        result = engine.calculate(inp)
        # 합산 1,100만 > 한도 900만 → 900만 × 16.5% = 1,485,000
        assert result.pension_tax_credit == 1_485_000


class TestFinancialIncomeComprehensive:
    def test_below_threshold_withholding(self, engine):
        inp = TaxInput(financial_income=15_000_000)
        result = engine.calculate(inp)
        # 2천만 이하: 분리과세 15.4%
        assert result.financial_income_withholding == int(15_000_000 * 0.154)

    def test_above_threshold_comprehensive(self, engine):
        inp = TaxInput(financial_income=25_000_000)
        result = engine.calculate(inp)
        # 2천만 초과 → 종합과세 대상
        assert result.alerts != []  # 경고 있어야 함


class TestGiftTax:
    def test_spouse_within_deduction(self, engine):
        result = engine.calculate_gift_tax(
            gift_amount=500_000_000, recipient="spouse"
        )
        # 5억 < 6억 공제 → 증여세 0
        assert result.gift_tax == 0

    def test_spouse_excess(self, engine):
        result = engine.calculate_gift_tax(
            gift_amount=700_000_000, recipient="spouse"
        )
        # 7억 - 6억 = 1억, 1억 × 10% = 1천만
        assert result.gift_tax == 10_000_000

    def test_prior_gifts_reduce_deduction(self, engine):
        result = engine.calculate_gift_tax(
            gift_amount=200_000_000, recipient="spouse", prior_gifts_10y=500_000_000
        )
        # 잔여 공제 1억, 증여 2억 → 과세 1억 × 10% = 1천만
        assert result.gift_tax == 10_000_000


class TestInheritanceTax:
    def test_basic_with_spouse(self, engine):
        result = engine.calculate_inheritance_tax(
            gross_estate=1_000_000_000,
            has_spouse=True,
            spouse_share=0.5,
        )
        assert result.inheritance_tax > 0
        assert result.taxable_estate < result.gross_estate

    def test_lump_sum_deduction_applied(self, engine):
        result = engine.calculate_inheritance_tax(
            gross_estate=600_000_000,
            has_spouse=False,
        )
        # 일괄공제 5억 적용
        assert result.total_deduction >= 500_000_000
