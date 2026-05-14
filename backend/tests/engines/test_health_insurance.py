"""
건강보험료 엔진 단위 테스트
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.engines.health_insurance import HealthInsuranceEngine, HealthInsuranceInput, SubscriberType


@pytest.fixture
def engine():
    return HealthInsuranceEngine()


class TestRegionalSubscriber:
    def test_income_premium_basic(self, engine):
        inp = HealthInsuranceInput(
            subscriber_type=SubscriberType.REGIONAL,
            financial_income=20_000_000,
            pension_income_public=10_000_000,
        )
        result = engine.calculate(inp)
        # 소득보험료: (2천만 + 5백만) / 12 × 8.09% ≈ 월 17만원대
        assert result.income_premium > 100_000
        assert result.monthly_premium >= result.income_premium

    def test_min_premium_applied(self, engine):
        inp = HealthInsuranceInput(
            subscriber_type=SubscriberType.REGIONAL,
            financial_income=1_000_000,
        )
        result = engine.calculate(inp)
        assert result.monthly_premium >= 19780  # 최저 보험료

    def test_vehicle_exempt_old_car(self, engine):
        inp = HealthInsuranceInput(
            subscriber_type=SubscriberType.REGIONAL,
            vehicle_value=50_000_000,
            vehicle_displacement_cc=2000,
            vehicle_age_years=10,  # 9년 이상 면제
        )
        result = engine.calculate(inp)
        assert result.vehicle_premium == 0

    def test_vehicle_exempt_cheap_car(self, engine):
        inp = HealthInsuranceInput(
            subscriber_type=SubscriberType.REGIONAL,
            vehicle_value=3_500_000,  # 4천만원 미만
            vehicle_displacement_cc=2000,
        )
        result = engine.calculate(inp)
        assert result.vehicle_premium == 0


class TestDependentEligibility:
    def test_eligible_under_threshold(self, engine):
        inp = HealthInsuranceInput(
            subscriber_type=SubscriberType.DEPENDENT,
            financial_income=9_000_000,
            pension_income_public=5_000_000,
            real_estate_assessed=300_000_000,
            is_dependent_candidate=True,
        )
        result = engine.calculate(inp)
        assert result.is_dependent_eligible is True
        assert result.monthly_premium == 0

    def test_disqualified_financial_income(self, engine):
        inp = HealthInsuranceInput(
            subscriber_type=SubscriberType.DEPENDENT,
            financial_income=12_000_000,  # 1천만원 초과
            is_dependent_candidate=True,
        )
        result = engine.calculate(inp)
        assert result.is_dependent_eligible is False
        assert any("금융소득" in r for r in result.dependent_disqualification_reasons)

    def test_disqualified_property(self, engine):
        inp = HealthInsuranceInput(
            subscriber_type=SubscriberType.DEPENDENT,
            real_estate_assessed=600_000_000,  # 5.4억 초과
            financial_income=5_000_000,
            is_dependent_candidate=True,
        )
        result = engine.calculate(inp)
        assert result.is_dependent_eligible is False


class TestAlerts:
    def test_financial_income_warning(self, engine):
        inp = HealthInsuranceInput(
            subscriber_type=SubscriberType.REGIONAL,
            financial_income=20_000_000,
        )
        result = engine.calculate(inp)
        assert any("금융소득" in a for a in result.alerts)

    def test_private_pension_warning(self, engine):
        inp = HealthInsuranceInput(
            subscriber_type=SubscriberType.REGIONAL,
            pension_income_private=16_000_000,
        )
        result = engine.calculate(inp)
        assert any("분리과세" in a for a in result.alerts)
