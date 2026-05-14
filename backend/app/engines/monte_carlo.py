"""
몬테카를로 시뮬레이션 엔진
- Correlation Matrix 기반 다변량 정규분포
- Fat Tail (t-분포) — 극단 리스크 반영
- Sequence of Returns Risk
- Volatility Clustering (GARCH-like)
- Regime Switching
- 연령별 생존 확률
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import numpy as np
from scipy import stats
from scipy.linalg import cholesky

from app.core.policy_loader import get_policy_loader


@dataclass
class MonteCarloInput:
    # 자산 배분 (합계 1.0)
    asset_allocation: dict[str, float]  # {"us_stock": 0.4, "bond": 0.3, ...}

    # 재무 상태
    initial_portfolio: float          # 초기 포트폴리오 (원)
    annual_withdrawal: float          # 연간 인출금 (물가 연동)
    annual_income: float = 0          # 연금 등 고정 수입
    withdrawal_inflation_rate: float = 0.025

    # 시뮬레이션 설정
    current_age: int = 65
    target_age: int = 100
    num_simulations: int = 10000

    # 인출 전략
    withdrawal_strategy: str = "fixed"  # fixed / guardrails / vpw / floor_ceiling

    # Guardrails 설정
    guardrail_upper: float = 1.20   # 상한 (포트폴리오 대비 인출률)
    guardrail_lower: float = 0.80   # 하한
    guardrail_base_rate: float = 0.04

    # Fat Tail 설정
    use_fat_tail: bool = True
    fat_tail_df: int = 5            # t-분포 자유도 (낮을수록 꼬리 두꺼움)

    # Regime Switching
    use_regime_switching: bool = True
    bear_market_prob: float = 0.20  # 약세장 확률
    bear_market_return_reduction: float = 0.15


@dataclass
class MonteCarloResult:
    num_simulations: int
    years: int

    # 생존 확률
    survival_prob_target_age: float
    survival_prob_90: float
    survival_prob_95: float
    survival_prob_100: float

    # 자산 고갈 통계
    depletion_probability: float
    median_depletion_age: Optional[float]
    expected_depletion_age: Optional[float]

    # 자산 분포 (연령별 백분위수)
    percentiles_by_age: dict[int, dict[str, float]]  # {age: {p10, p25, p50, p75, p90}}

    # 최종 자산 분포
    final_assets_p10: float
    final_assets_p25: float
    final_assets_p50: float
    final_assets_p75: float
    final_assets_p90: float

    # 인출 통계 (전략별)
    median_annual_withdrawal: float
    min_annual_withdrawal: float

    # 스트레스 시나리오 결과
    scenario_results: dict[str, float] = field(default_factory=dict)


class MonteCarloEngine:
    ASSET_NAMES = ["us_stock", "kr_stock", "bond", "cash", "real_estate", "reits", "global_bond"]

    def __init__(self):
        policy = get_policy_loader()
        self._macro = policy.macro
        self._returns = policy.get_asset_returns()
        self._corr = policy.get_correlation_matrix()
        self._scenarios = policy.get_stress_scenarios()

    # 연간 레짐 전환 확률 (고정값 — years로 나누지 않음)
    # 실증 연구 기반: 약세장 진입 약 12%/년, 탈출 약 40%/년
    _BEAR_ENTRY_PROB_ANNUAL: float = 0.12
    _BEAR_EXIT_PROB_ANNUAL: float = 0.40

    def run(self, inp: MonteCarloInput) -> MonteCarloResult:
        np.random.seed(None)
        years = inp.target_age - inp.current_age
        n_sim = inp.num_simulations

        # 자산 배분 벡터 구성
        alloc = self._build_allocation_vector(inp.asset_allocation)
        mu, sigma, corr = self._build_distribution_params(alloc)

        # Cholesky 분해 (상관관계 반영 난수 생성)
        chol = cholesky(corr, lower=True)

        # 시뮬레이션 실행
        portfolios = np.full(n_sim, inp.initial_portfolio)
        survived = np.ones(n_sim, dtype=bool)
        depletion_ages = np.full(n_sim, np.nan)

        # 연령별 자산 추적
        age_portfolios: dict[int, np.ndarray] = {}

        withdrawal = inp.annual_withdrawal
        regime_state = np.zeros(n_sim)  # 0 = 정상장, 1 = 약세장

        # GARCH-like: 전년도 충격이 올해 변동성에 영향
        # vol_t = sqrt(omega + alpha * shock_{t-1}^2 + beta * vol_{t-1}^2)
        _GARCH_OMEGA = 0.000002   # 장기 분산 기여
        _GARCH_ALPHA = 0.15       # 충격 민감도
        _GARCH_BETA  = 0.80       # 변동성 지속성
        prev_shock = np.zeros(n_sim)          # 전기 포트폴리오 충격
        prev_vol   = np.full(n_sim, sigma @ alloc)  # 전기 변동성 (포트폴리오 가중)

        for year in range(years):
            age = inp.current_age + year

            # 1. Regime Switching (연간 고정 확률 — BUG FIX: / years 제거)
            if inp.use_regime_switching:
                regime_switch = np.random.random(n_sim)
                entering_bear = (regime_state == 0) & (regime_switch < self._BEAR_ENTRY_PROB_ANNUAL)
                exiting_bear  = (regime_state == 1) & (regime_switch < self._BEAR_EXIT_PROB_ANNUAL)
                regime_state[entering_bear] = 1
                regime_state[exiting_bear]  = 0

            # 2. GARCH-like 변동성 스케일 계산 (시뮬레이션별 독립)
            garch_vol = np.sqrt(
                _GARCH_OMEGA
                + _GARCH_ALPHA * prev_shock ** 2
                + _GARCH_BETA  * prev_vol   ** 2
            )  # shape: (n_sim,)

            # 3. 수익률 생성 (Fat Tail or Normal)
            if inp.use_fat_tail:
                raw = stats.t.rvs(df=inp.fat_tail_df, size=(n_sim, len(self.ASSET_NAMES)))
                raw = raw / np.sqrt(inp.fat_tail_df / (inp.fat_tail_df - 2))
            else:
                raw = np.random.standard_normal((n_sim, len(self.ASSET_NAMES)))

            correlated = raw @ chol.T  # (n_sim, n_assets)
            asset_returns = mu + sigma * correlated  # 연간 수익률

            # Regime 조정 (약세장이면 수익률 하향)
            if inp.use_regime_switching:
                bear_mask = regime_state == 1
                asset_returns[bear_mask] -= inp.bear_market_return_reduction

            # GARCH 스케일 적용: 기대수익(mu @ alloc)은 유지, 변동성만 스케일
            base_vol = float(sigma @ alloc)
            portfolio_returns_raw = asset_returns @ alloc
            portfolio_mean = float(mu @ alloc)
            # deviation에 GARCH vol 스케일 적용
            garch_scale = np.clip(garch_vol / (base_vol + 1e-10), 0.5, 3.0)
            portfolio_returns = portfolio_mean + (portfolio_returns_raw - portfolio_mean) * garch_scale

            # GARCH 상태 업데이트
            port_shock = portfolio_returns - portfolio_mean
            prev_shock = port_shock
            prev_vol   = garch_vol

            # 3. 인출 전략 적용
            if inp.withdrawal_strategy == "guardrails":
                withdrawal_amounts = self._guardrails_withdrawal(
                    portfolios, withdrawal, inp, year
                )
            elif inp.withdrawal_strategy == "vpw":
                withdrawal_amounts = self._vpw_withdrawal(portfolios, years - year, inp)
            elif inp.withdrawal_strategy == "floor_ceiling":
                withdrawal_amounts = self._floor_ceiling_withdrawal(
                    portfolios, withdrawal, inp
                )
            else:
                withdrawal_amounts = np.full(n_sim, withdrawal)

            # 연금 등 고정 수입 차감
            net_withdrawal = withdrawal_amounts - inp.annual_income
            net_withdrawal = np.maximum(net_withdrawal, 0)

            # 4. 자산 업데이트
            growth = 1 + portfolio_returns
            portfolios = portfolios * growth - net_withdrawal
            portfolios = np.maximum(portfolios, 0)

            # 고갈 감지
            newly_depleted = survived & (portfolios <= 0)
            depletion_ages[newly_depleted] = age + 1
            survived[newly_depleted] = False

            # 연령별 스냅샷
            if (year % 5 == 0) or (year == years - 1):
                age_portfolios[age + 1] = portfolios.copy()

            # 인출액 물가 연동
            withdrawal *= (1 + inp.withdrawal_inflation_rate)

        # 결과 집계
        return self._aggregate_results(
            inp, portfolios, survived, depletion_ages, age_portfolios, years
        )

    def _build_allocation_vector(self, allocation: dict[str, float]) -> np.ndarray:
        vec = np.zeros(len(self.ASSET_NAMES))
        for i, name in enumerate(self.ASSET_NAMES):
            vec[i] = allocation.get(name, 0.0)
        total = vec.sum()
        if total > 0:
            vec /= total
        return vec

    def _build_distribution_params(
        self, alloc: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        mu = np.array([self._returns[a]["expected_return"] for a in self.ASSET_NAMES])
        sigma = np.array([self._returns[a]["volatility"] for a in self.ASSET_NAMES])
        corr_matrix = np.array(self._corr["matrix"])
        return mu, sigma, corr_matrix

    def _guardrails_withdrawal(
        self,
        portfolios: np.ndarray,
        base_withdrawal: float,
        inp: MonteCarloInput,
        year: int,
    ) -> np.ndarray:
        """Guyton-Klinger Guardrails"""
        base_rate = inp.guardrail_base_rate
        withdrawal_rates = np.where(portfolios > 0, base_withdrawal / np.maximum(portfolios, 1), 0)

        upper = base_rate * inp.guardrail_upper
        lower = base_rate * inp.guardrail_lower

        amounts = np.full_like(portfolios, base_withdrawal)
        amounts[withdrawal_rates > upper] *= 0.90   # 인출 10% 감축
        amounts[withdrawal_rates < lower] *= 1.10   # 인출 10% 증가
        return np.maximum(amounts, 0)

    def _vpw_withdrawal(
        self,
        portfolios: np.ndarray,
        remaining_years: int,
        inp: MonteCarloInput,
    ) -> np.ndarray:
        """Variable Percentage Withdrawal
        실질 수익률 = 자산배분 가중 기대수익률 - 인출 인플레이션율 (하드코딩 0.04 제거)
        """
        if remaining_years <= 0:
            return portfolios.copy()
        alloc = self._build_allocation_vector(inp.asset_allocation)
        mu = np.array([self._returns[a]["expected_return"] for a in self.ASSET_NAMES])
        nominal_return = float(mu @ alloc)
        # 실질 수익률: 명목 수익률 - 물가상승률 (Fisher 근사)
        r = max(nominal_return - inp.withdrawal_inflation_rate, 0.01)
        factor = r / (1 - (1 + r) ** (-remaining_years))
        return portfolios * factor

    def _floor_ceiling_withdrawal(
        self,
        portfolios: np.ndarray,
        base_withdrawal: float,
        inp: MonteCarloInput,
    ) -> np.ndarray:
        """Floor & Ceiling Strategy"""
        floor = base_withdrawal * 0.85
        ceiling = base_withdrawal * 1.15
        vpw = self._vpw_withdrawal(portfolios, inp.target_age - inp.current_age, inp)
        return np.clip(vpw, floor, ceiling)

    def _aggregate_results(
        self,
        inp: MonteCarloInput,
        final_portfolios: np.ndarray,
        survived: np.ndarray,
        depletion_ages: np.ndarray,
        age_portfolios: dict[int, np.ndarray],
        years: int,
    ) -> MonteCarloResult:
        n_sim = inp.num_simulations
        depleted = ~survived

        survival_prob = survived.mean()
        depletion_prob = depleted.mean()

        # 생존 시뮬레이션은 target_age+1로 채워 전체 50번째 백분위수를 구함
        # (nanmedian은 고갈된 시뮬레이션만 대상이라 부정확)
        all_depletion = np.where(np.isnan(depletion_ages), inp.target_age + 1, depletion_ages)
        p50_depletion = float(np.percentile(all_depletion, 50))
        median_depletion = None if p50_depletion > inp.target_age else p50_depletion

        expected_depletion = float(np.nanmean(depletion_ages)) if depleted.any() else None

        # 연령별 백분위수
        percentiles_by_age = {}
        for age, snapshots in age_portfolios.items():
            percentiles_by_age[age] = {
                "p10": float(np.percentile(snapshots, 10)),
                "p25": float(np.percentile(snapshots, 25)),
                "p50": float(np.percentile(snapshots, 50)),
                "p75": float(np.percentile(snapshots, 75)),
                "p90": float(np.percentile(snapshots, 90)),
            }

        # 90/95/100세 생존 확률
        def survival_at_age(target: int) -> float:
            target_year = target - inp.current_age
            if target_year <= 0 or target_year > years:
                return 0.0
            age_data = age_portfolios.get(target)
            if age_data is None:
                return survival_prob
            return float((age_data > 0).mean())

        return MonteCarloResult(
            num_simulations=n_sim,
            years=years,
            survival_prob_target_age=float(survival_prob),
            survival_prob_90=survival_at_age(90),
            survival_prob_95=survival_at_age(95),
            survival_prob_100=survival_at_age(100),
            depletion_probability=float(depletion_prob),
            median_depletion_age=median_depletion,
            expected_depletion_age=expected_depletion,
            percentiles_by_age=percentiles_by_age,
            final_assets_p10=float(np.percentile(final_portfolios, 10)),
            final_assets_p25=float(np.percentile(final_portfolios, 25)),
            final_assets_p50=float(np.percentile(final_portfolios, 50)),
            final_assets_p75=float(np.percentile(final_portfolios, 75)),
            final_assets_p90=float(np.percentile(final_portfolios, 90)),
            median_annual_withdrawal=float(inp.annual_withdrawal),
            min_annual_withdrawal=float(inp.annual_withdrawal * 0.85),
        )

    # ── 스트레스 테스트 ─────────────────────────────────────────────────────
    def stress_test(self, inp: MonteCarloInput) -> dict[str, MonteCarloResult]:
        """정책 변경 및 시장 시나리오 스트레스 테스트
        각 시나리오별로 macro.json의 충격값을 실제 수익률에 반영 (BUG FIX)
        """
        results = {}
        scenarios = self._scenarios

        # 베이스
        results["base"] = self.run(inp)

        # ── 글로벌 금융위기: 첫 2년 주식 급락 반영 ──────────────────────
        crisis_inp = MonteCarloInput(**inp.__dict__)
        crisis_inp.num_simulations = 1000
        # 미국/한국 주식 충격을 bear_market_return_reduction으로 근사
        us_shock = abs(scenarios["global_financial_crisis"]["us_stock_shock"])  # 0.50
        crisis_inp.bear_market_prob = 1.0                  # 첫 2년은 무조건 약세장
        crisis_inp.bear_market_return_reduction = us_shock  # 50% 충격
        results["global_financial_crisis"] = self.run(crisis_inp)

        # ── 고인플레이션 ──────────────────────────────────────────────────
        high_inflation = MonteCarloInput(**inp.__dict__)
        high_inflation.num_simulations = 1000
        high_inflation.withdrawal_inflation_rate = scenarios["high_inflation"]["inflation_rate"]
        # 실질 수익률 감소 반영
        real_return_reduction = abs(scenarios["high_inflation"].get("real_return_reduction", 0.04))
        high_inflation.bear_market_return_reduction = real_return_reduction
        results["high_inflation"] = self.run(high_inflation)

        # ── 고금리: 채권 충격 (채권 비중이 높을수록 타격) ────────────────
        high_rate = MonteCarloInput(**inp.__dict__)
        high_rate.num_simulations = 1000
        bond_shock = abs(scenarios["high_interest"]["bond_shock"])  # 0.15
        bond_alloc = inp.asset_allocation.get("bond", 0) + inp.asset_allocation.get("global_bond", 0)
        portfolio_bond_impact = bond_shock * bond_alloc  # 포트폴리오 가중 충격
        high_rate.bear_market_return_reduction = max(portfolio_bond_impact, 0.05)
        results["high_interest"] = self.run(high_rate)

        # ── 장기 침체: 10년간 연 -5% ─────────────────────────────────────
        recession = MonteCarloInput(**inp.__dict__)
        recession.num_simulations = 1000
        annual_loss = abs(scenarios["prolonged_recession"]["stock_annual_return"])  # 0.05
        recession.bear_market_prob = 1.0                   # 항상 약세장
        recession.bear_market_return_reduction = annual_loss
        results["prolonged_recession"] = self.run(recession)

        # ── 국민연금 개혁: 급여 20% 감소 (annual_income 감소로 반영) ──────
        pension_reform = MonteCarloInput(**inp.__dict__)
        pension_reform.num_simulations = 1000
        benefit_cut = scenarios["pension_reduction"]["benefit_reduction"]  # 0.20
        pension_reform.annual_income = inp.annual_income * (1 - benefit_cut)
        results["pension_reduction"] = self.run(pension_reform)

        return results

    # ── 인출 전략 비교 ──────────────────────────────────────────────────────
    def compare_withdrawal_strategies(self, inp: MonteCarloInput) -> dict[str, MonteCarloResult]:
        strategies = ["fixed", "guardrails", "vpw", "floor_ceiling"]
        results = {}
        comp_inp = MonteCarloInput(**inp.__dict__)
        comp_inp.num_simulations = 5000

        for strategy in strategies:
            comp_inp.withdrawal_strategy = strategy
            results[strategy] = self.run(comp_inp)

        return results
