'use client'

import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Shield, Calculator, PiggyBank, Activity,
} from 'lucide-react'
import { formatKRW, formatPercent, runCashflow, runMonteCarlo } from '@/lib/api'
import { CashflowChart } from '@/components/charts/CashflowChart'
import { MonteCarloChart } from '@/components/charts/MonteCarloChart'
import { AlertList } from '@/components/ui/AlertList'

// 데모 프로파일 (실제 서비스에서는 저장된 프로파일 사용)
const DEMO_PROFILE = {
  current_age: 65,
  target_age: 100,
  gender: 'male',
  retirement_age: 65,
  monthly_salary: 0,
  national_pension_monthly: 1_200_000,
  pension_start_age: 65,
  private_pension_monthly: 800_000,
  private_pension_start_age: 65,
  financial_assets: 500_000_000,
  financial_income_yield: 0.035,
  real_estate_value: 600_000_000,
  real_estate_loan: 0,
  rental_income_monthly: 1_000_000,
  pension_savings_balance: 150_000_000,
  irp_balance: 80_000_000,
  isa_balance: 50_000_000,
  us_stock_value: 200_000_000,
  us_stock_return: 0.085,
  monthly_living_expense: 3_000_000,
  monthly_medical_expense: 300_000,
  monthly_housing_expense: 0,
  inflation_rate: 0.025,
  medical_inflation_rate: 0.04,
  subscriber_type: 'regional',
  real_estate_assessed: 400_000_000,
}

const MC_PARAMS = {
  asset_allocation: { us_stock: 0.35, kr_stock: 0.05, bond: 0.30, cash: 0.10, reits: 0.10, real_estate: 0.05, global_bond: 0.05 },
  initial_portfolio: 980_000_000,
  annual_withdrawal: 60_000_000,
  annual_income: 24_000_000,
  withdrawal_inflation_rate: 0.025,
  current_age: 65,
  target_age: 100,
  num_simulations: 5000,
  use_fat_tail: true,
  use_regime_switching: true,
}

export function DashboardClient() {
  const { data: cashflow, isLoading: cfLoading } = useQuery({
    queryKey: ['cashflow', 'demo'],
    queryFn: () => runCashflow(DEMO_PROFILE),
    staleTime: 10 * 60 * 1000,
  })

  const { data: mc, isLoading: mcLoading } = useQuery({
    queryKey: ['monte-carlo', 'demo'],
    queryFn: () => runMonteCarlo(MC_PARAMS),
    staleTime: 10 * 60 * 1000,
  })

  const summary = cashflow?.summary
  const isLoading = cfLoading || mcLoading

  // 모든 경고 수집 (camelCase 변환 후: yearlyData)
  const allAlerts: string[] = []
  const yearlyData = (cashflow as any)?.yearlyData ?? cashflow?.yearly_data
  if (yearlyData) {
    yearlyData.forEach((y: any) => allAlerts.push(...(y.alerts ?? [])))
  }
  const uniqueAlerts = [...new Set(allAlerts)].slice(0, 8)

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-heading1 font-bold text-neutral-900">은퇴 현황 대시보드</h1>
        <p className="mt-1 text-body-lg text-neutral-500">
          2026년 세법 기준 · 국민건강보험공단 기준 · 실시간 계산
        </p>
      </div>

      {/* 핵심 지표 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="100세 생존 확률"
          value={mc ? formatPercent(mc.survivalProb100) : '—'}
          subtext={mc ? `자산 고갈 확률 ${formatPercent(mc.depletionProbability)}` : '계산 중...'}
          icon={<Shield className="text-brand-500" size={24} />}
          variant={mc && mc.survivalProb100 > 0.7 ? 'success' : 'warning'}
          loading={mcLoading}
        />
        <StatCard
          label="자산 고갈 예상 시점"
          value={summary?.depletionAge ? `${summary.depletionAge}세` : '100세 이상'}
          subtext={summary ? `현재 ${summary.survivedToAge}세까지 안전` : '계산 중...'}
          icon={<Activity className="text-brand-500" size={24} />}
          variant={!summary?.depletionAge ? 'success' : 'warning'}
          loading={cfLoading}
        />
        <StatCard
          label="월 안정 인출 가능액"
          value={mc ? formatKRW(mc.medianAnnualWithdrawal / 12) : '—'}
          subtext="중앙값 기준 인출 가능금액"
          icon={<TrendingUp className="text-brand-500" size={24} />}
          variant="neutral"
          loading={mcLoading}
        />
        <StatCard
          label="예상 평생 세금 + 건보료"
          value={
            summary
              ? formatKRW(summary.totalLifetimeTax + summary.totalLifetimeHealthInsurance)
              : '—'
          }
          subtext={
            summary
              ? `세금 ${formatKRW(summary.totalLifetimeTax)} / 건보료 ${formatKRW(summary.totalLifetimeHealthInsurance)}`
              : '계산 중...'
          }
          icon={<Calculator className="text-brand-500" size={24} />}
          variant="neutral"
          loading={cfLoading}
        />
      </div>

      {/* 현금흐름 타임라인 */}
      <section aria-labelledby="cashflow-title">
        <h2 id="cashflow-title" className="section-title">100세 현금흐름 타임라인</h2>
        <div className="card-lg">
          {cfLoading ? (
            <LoadingSkeleton height="h-80" />
          ) : yearlyData ? (
            <CashflowChart data={yearlyData} />
          ) : (
            <EmptyState message="현금흐름 데이터를 불러오는 중입니다" />
          )}
        </div>
      </section>

      {/* 몬테카를로 생존 확률 */}
      <section aria-labelledby="mc-title">
        <h2 id="mc-title" className="section-title">몬테카를로 생존 확률 분포</h2>
        <div className="card-lg">
          {mcLoading ? (
            <LoadingSkeleton height="h-80" />
          ) : mc?.percentilesByAge ? (
            <MonteCarloChart data={mc.percentilesByAge} currentAge={65} />
          ) : (
            <EmptyState message="몬테카를로 시뮬레이션 결과를 불러오는 중입니다" />
          )}
        </div>
      </section>

      {/* 하단 2단 구성 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 자산 분포 요약 */}
        <section aria-labelledby="assets-title" className="card">
          <h2 id="assets-title" className="text-heading3 font-bold mb-4">자산 분포</h2>
          <AssetBreakdown />
        </section>

        {/* 경고 및 최적화 제안 */}
        <section aria-labelledby="alerts-title" className="card">
          <h2 id="alerts-title" className="text-heading3 font-bold mb-4">
            경고 및 최적화 제안
          </h2>
          <AlertList alerts={uniqueAlerts} loading={cfLoading} />
        </section>
      </div>

      {/* 스트레스 테스트 요약 */}
      <section aria-labelledby="stress-title">
        <h2 id="stress-title" className="section-title">시나리오별 생존 확률</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {STRESS_SCENARIOS.map((s) => (
            <div key={s.name} className="card text-center">
              <p className="text-caption font-medium text-neutral-500 mb-2">{s.name}</p>
              <p
                className={`text-heading2 font-bold ${
                  s.prob >= 0.7
                    ? 'text-success'
                    : s.prob >= 0.5
                    ? 'text-warning'
                    : 'text-danger'
                }`}
              >
                {formatPercent(s.prob)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── 하위 컴포넌트 ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, subtext, icon, variant, loading,
}: {
  label: string
  value: string
  subtext: string
  icon: React.ReactNode
  variant: 'success' | 'warning' | 'danger' | 'neutral'
  loading?: boolean
}) {
  const borderColor = {
    success: 'border-l-4 border-l-success',
    warning: 'border-l-4 border-l-warning',
    danger: 'border-l-4 border-l-danger',
    neutral: 'border-l-4 border-l-brand-500',
  }[variant]

  return (
    <div className={`card ${borderColor}`} role="region" aria-label={label}>
      <div className="flex items-start justify-between mb-3">
        <span className="stat-label">{label}</span>
        {icon}
      </div>
      {loading ? (
        <div className="h-8 bg-neutral-100 rounded animate-pulse w-3/4" />
      ) : (
        <p className="stat-value">{value}</p>
      )}
      <p className="text-caption text-neutral-500 mt-1">{subtext}</p>
    </div>
  )
}

function AssetBreakdown() {
  const assets = [
    { label: '금융자산', amount: 500_000_000, color: 'bg-brand-500' },
    { label: '부동산', amount: 600_000_000, color: 'bg-green-500' },
    { label: '연금저축 + IRP', amount: 230_000_000, color: 'bg-amber-500' },
    { label: 'ISA', amount: 50_000_000, color: 'bg-purple-500' },
    { label: '해외주식', amount: 200_000_000, color: 'bg-pink-500' },
  ]
  const total = assets.reduce((s, a) => s + a.amount, 0)

  return (
    <div className="space-y-3">
      <p className="text-heading2 font-bold text-neutral-900">{formatKRW(total)}</p>
      <p className="text-caption text-neutral-500 mb-4">총 자산</p>
      {assets.map((a) => (
        <div key={a.label}>
          <div className="flex justify-between text-body mb-1">
            <span className="font-medium">{a.label}</span>
            <span className="text-neutral-600">{formatKRW(a.amount)}</span>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${a.color} rounded-full transition-all duration-500`}
              style={{ width: `${(a.amount / total) * 100}%` }}
              role="progressbar"
              aria-valuenow={(a.amount / total) * 100}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${a.label} 비중`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function LoadingSkeleton({ height }: { height: string }) {
  return (
    <div className={`${height} bg-neutral-100 rounded-xl animate-pulse`} aria-hidden="true" />
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-80 flex items-center justify-center text-neutral-400">
      <p className="text-body">{message}</p>
    </div>
  )
}

// 시나리오 데이터 (실제에서는 API 응답)
const STRESS_SCENARIOS = [
  { name: '기본 시나리오', prob: 0.84 },
  { name: '고인플레이션', prob: 0.71 },
  { name: '고금리', prob: 0.78 },
  { name: '장기 침체', prob: 0.62 },
  { name: '글로벌 금융위기', prob: 0.55 },
]
