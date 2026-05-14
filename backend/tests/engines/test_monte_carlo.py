"""
몬테카를로 엔진 단위 테스트
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.engines.monte_carlo import MonteCarloEngine, MonteCarloInput


@pytest.fixture
def engine():
    return MonteCarloEngine()


@pytest.fixture
def base_input():
    return MonteCarloInput(
        asset_allocation={"us_stock": 0.40, "bond": 0.40, "cash": 0.20},
        initial_portfolio=1_000_000_000,
        annual_withdrawal=40_000_000,
        annual_income=15_000_000,
        current_age=65,
        target_age=100,
        num_simulations=500,  # 테스트용 소규모
        use_fat_tail=True,
        use_regime_switching=True,
    )


class TestMonteCarloBasic:
    def test_result_shape(self, engine, base_input):
        result = engine.run(base_input)
        assert result.num_simulations == 500
        assert 0.0 <= result.depletion_probability <= 1.0
        assert 0.0 <= result.survival_prob_target_age <= 1.0

    def test_survival_prob_decreases_over_time(self, engine, base_input):
        result = engine.run(base_input)
        # 100세 생존확률 ≤ 90세 생존확률
        assert result.survival_prob_100 <= result.survival_prob_90

    def test_percentiles_ordered(self, engine, base_input):
        result = engine.run(base_input)
        for age, pcts in result.percentiles_by_age.items():
            assert pcts["p10"] <= pcts["p25"] <= pcts["p50"] <= pcts["p75"] <= pcts["p90"]

    def test_high_withdrawal_low_survival(self, engine, base_input):
        # 과도한 인출 시 생존율 낮아야 함
        risky = MonteCarloInput(
            **{**base_input.__dict__, "annual_withdrawal": 200_000_000}
        )
        result = engine.run(risky)
        assert result.depletion_probability > 0.5

    def test_conservative_portfolio_higher_survival(self, engine):
        conservative = MonteCarloInput(
            asset_allocation={"cash": 0.50, "bond": 0.50},
            initial_portfolio=2_000_000_000,
            annual_withdrawal=30_000_000,
            annual_income=20_000_000,
            current_age=65,
            target_age=95,
            num_simulations=500,
        )
        result = engine.run(conservative)
        assert result.survival_prob_target_age > 0.7


class TestWithdrawalStrategies:
    def test_all_strategies_run(self, engine, base_input):
        results = engine.compare_withdrawal_strategies(base_input)
        assert set(results.keys()) == {"fixed", "guardrails", "vpw", "floor_ceiling"}

    def test_guardrails_has_lower_volatility(self, engine, base_input):
        results = engine.compare_withdrawal_strategies(base_input)
        # guardrails는 fixed 대비 고갈확률이 낮거나 비슷해야 함
        assert results["guardrails"].depletion_probability <= results["fixed"].depletion_probability + 0.10
