'use client'

import { useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface FormData {
  age: number
  gender: 'male' | 'female'
  retirementAge: number
  // 연금
  nationalPensionMonthly: number
  pensionSavings: number
  irp: number
  isa: number
  // 금융자산
  financialAssets: number
  usStock: number
  // 부동산
  realEstateValue: number
  realEstateLoan: number
  rentalIncomeMonthly: number
  // 지출
  monthlyExpense: number
  monthlyMedical: number
}

interface SimResult {
  yearlyData: any[]
  summary: any
  mcResult: any
  hiResult: any
  taxResult: any
}

// ── 기본값 ─────────────────────────────────────────────────────────────────────
const DEFAULT: FormData = {
  age: 65,
  gender: 'male',
  retirementAge: 65,
  nationalPensionMonthly: 1200000,
  pensionSavings: 150000000,
  irp: 80000000,
  isa: 50000000,
  financialAssets: 300000000,
  usStock: 100000000,
  realEstateValue: 500000000,
  realEstateLoan: 0,
  rentalIncomeMonthly: 0,
  monthlyExpense: 3000000,
  monthlyMedical: 200000,
}

const API = '/api/v1'

async function runSimulation(f: FormData): Promise<SimResult> {
  const profile = {
    current_age: f.age,
    target_age: 100,
    gender: f.gender,
    retirement_age: f.retirementAge,
    monthly_salary: 0,
    national_pension_monthly: f.nationalPensionMonthly,
    pension_start_age: f.retirementAge,
    private_pension_monthly: Math.floor((f.pensionSavings + f.irp) / (Math.max(100 - f.retirementAge, 10) * 12)),
    private_pension_start_age: f.retirementAge,
    financial_assets: f.financialAssets,
    financial_income_yield: 0.035,
    real_estate_value: f.realEstateValue,
    real_estate_loan: f.realEstateLoan,
    rental_income_monthly: f.rentalIncomeMonthly,
    pension_savings_balance: f.pensionSavings,
    irp_balance: f.irp,
    isa_balance: f.isa,
    us_stock_value: f.usStock,
    us_stock_return: 0.085,
    monthly_living_expense: f.monthlyExpense,
    monthly_medical_expense: f.monthlyMedical,
    monthly_housing_expense: 0,
    inflation_rate: 0.025,
    medical_inflation_rate: 0.04,
    subscriber_type: 'regional',
    real_estate_assessed: Math.floor(f.realEstateValue * 0.7),
  }

  const totalPortfolio = f.financialAssets + f.usStock + f.pensionSavings + f.irp + f.isa
  const annualWithdrawal = f.monthlyExpense * 12
  const annualIncome = f.nationalPensionMonthly * 12 + f.rentalIncomeMonthly * 12

  const [cfRes, mcRes, hiRes] = await Promise.all([
    fetch(`${API}/simulation/cashflow/quick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }).then(r => r.json()),

    fetch(`${API}/simulation/monte-carlo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_allocation: { us_stock: 0.30, kr_stock: 0.10, bond: 0.30, cash: 0.15, reits: 0.10, real_estate: 0.05, global_bond: 0 },
        initial_portfolio: totalPortfolio,
        annual_withdrawal: Math.max(annualWithdrawal - annualIncome, 0),
        annual_income: 0,
        withdrawal_inflation_rate: 0.025,
        current_age: f.age,
        target_age: 100,
        num_simulations: 3000,
        use_fat_tail: true,
        use_regime_switching: true,
      }),
    }).then(r => r.json()),

    fetch(`${API}/simulation/health-insurance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriber_type: 'regional',
        financial_income: Math.floor(f.financialAssets * 0.035),
        pension_income_public: f.nationalPensionMonthly * 12,
        pension_income_private: Math.floor((f.pensionSavings + f.irp) / (Math.max(100 - f.retirementAge, 10) * 12)) * 12,
        rental_income: f.rentalIncomeMonthly * 12,
        real_estate_assessed: Math.floor(f.realEstateValue * 0.7),
      }),
    }).then(r => r.json()),
  ])

  return {
    yearlyData: cfRes.yearly_data ?? [],
    summary: cfRes.summary ?? {},
    mcResult: mcRes,
    hiResult: hiRes,
    taxResult: null,
  }
}

// ── 포맷 ─────────────────────────────────────────────────────────────────────
function won(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}
function pct(n: number | undefined | null, d = 1): string {
  if (n == null || isNaN(n)) return '—'
  return `${(n * 100).toFixed(d)}%`
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function Home() {
  const [form, setForm] = useState<FormData>(DEFAULT)
  const [result, setResult] = useState<SimResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = e.target.value
    setForm(prev => ({
      ...prev,
      [key]: e.target.type === 'number' ? (parseFloat(raw.replace(/,/g, '')) || 0) : raw,
    }))
  }

  const handleSubmit = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await runSimulation(form)
      setResult(res)
    } catch (e: any) {
      setError('계산 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }, [form])

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* 헤더 */}
      <header style={{ background: '#1e293b', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#4f6ef7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>노</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>노후설계</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>2026년 세법 · 건보료 기준</div>
          </div>
        </div>
        <a href="/guide" style={{ fontSize: 14, color: '#93c5fd', fontWeight: 600, textDecoration: 'none', padding: '8px 16px', border: '1px solid #334155', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          📚 노후설계 가이드
        </a>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>

        {/* ── 입력 패널 ─────────────────────────────────────────────────── */}
        <div style={{ flex: '0 0 340px', minWidth: 0 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#1e293b' }}>내 정보 입력</h2>

            <Section title="기본 정보">
              <Row label="현재 나이">
                <Num value={form.age} onChange={set('age')} min={50} max={85} suffix="세" />
              </Row>
              <Row label="은퇴 나이">
                <Num value={form.retirementAge} onChange={set('retirementAge')} min={50} max={80} suffix="세" />
              </Row>
              <Row label="성별">
                <select value={form.gender} onChange={set('gender')} style={inputStyle}>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </Row>
            </Section>

            <Section title="연금">
              <Row label="국민연금 (월)">
                <Num value={form.nationalPensionMonthly} onChange={set('nationalPensionMonthly')} suffix="원" step={10000} />
              </Row>
              <Row label="연금저축 잔액">
                <Num value={form.pensionSavings} onChange={set('pensionSavings')} suffix="원" step={1000000} />
              </Row>
              <Row label="IRP 잔액">
                <Num value={form.irp} onChange={set('irp')} suffix="원" step={1000000} />
              </Row>
              <Row label="ISA 잔액">
                <Num value={form.isa} onChange={set('isa')} suffix="원" step={1000000} />
              </Row>
            </Section>

            <Section title="금융자산">
              <Row label="예금·펀드·국내주식">
                <Num value={form.financialAssets} onChange={set('financialAssets')} suffix="원" step={10000000} />
              </Row>
              <Row label="해외주식 (미국 ETF 등)">
                <Num value={form.usStock} onChange={set('usStock')} suffix="원" step={10000000} />
              </Row>
            </Section>

            <Section title="부동산">
              <Row label="부동산 시세">
                <Num value={form.realEstateValue} onChange={set('realEstateValue')} suffix="원" step={10000000} />
              </Row>
              <Row label="대출 잔액">
                <Num value={form.realEstateLoan} onChange={set('realEstateLoan')} suffix="원" step={10000000} />
              </Row>
              <Row label="월세 수입">
                <Num value={form.rentalIncomeMonthly} onChange={set('rentalIncomeMonthly')} suffix="원" step={100000} />
              </Row>
            </Section>

            <Section title="월 지출">
              <Row label="생활비">
                <Num value={form.monthlyExpense} onChange={set('monthlyExpense')} suffix="원" step={100000} />
              </Row>
              <Row label="의료비">
                <Num value={form.monthlyMedical} onChange={set('monthlyMedical')} suffix="원" step={50000} />
              </Row>
            </Section>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', padding: '14px', background: loading ? '#94a3b8' : '#4f6ef7',
                color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8,
                transition: 'background 0.15s',
              }}
            >
              {loading ? '계산 중...' : '시뮬레이션 실행'}
            </button>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
          </div>
        </div>

        {/* ── 결과 패널 ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!result && !loading && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', color: '#94a3b8', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#64748b' }}>왼쪽에 자산을 입력하고</p>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#64748b' }}>시뮬레이션을 실행하세요</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>건보료 · 세금 · 100세 현금흐름 · 몬테카를로 분석</p>
            </div>
          )}

          {loading && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#4f6ef7' }}>계산 중...</p>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>3,000번 시뮬레이션 실행 중</p>
            </div>
          )}

          {result && !loading && <Results result={result} form={form} />}
        </div>
      </div>
    </div>
  )
}

// ── 결과 컴포넌트 ─────────────────────────────────────────────────────────────
function Results({ result, form }: { result: SimResult; form: FormData }) {
  const { yearlyData, summary, mcResult, hiResult } = result
  const hi = hiResult ?? {}
  const mc = mcResult ?? {}
  const s = summary ?? {}

  const currentAssets = form.financialAssets + form.usStock + form.pensionSavings + form.irp + form.isa + form.realEstateValue - form.realEstateLoan
  // 은퇴 시점 행: retirementAge 이상인 첫 번째 연도
  const retirementRow = yearlyData.find((d: any) => (d.age ?? 0) >= form.retirementAge)
  const retirementAssets = retirementRow ? (retirementRow.total_assets ?? retirementRow.totalAssets ?? null) : null

  // 현금흐름 차트 데이터 (5년 단위)
  const cfChartData = yearlyData
    .filter((_: any, i: number) => i % 5 === 0)
    .map((d: any) => ({
      age: `${d.age}세`,
      수입: Math.round((d.total_income ?? d.totalIncome ?? 0) / 10000),
      지출: Math.round((d.total_expense ?? d.totalExpense ?? 0) / 10000),
      자산: Math.round((d.total_assets ?? d.totalAssets ?? 0) / 100000000 * 10) / 10,
    }))

  // 몬테카를로 백분위 차트 (엔진이 5년 단위로 이미 필터링함 — age+1 키라 %5 필터 불필요)
  const mcChartData = Object.entries(mc.percentiles_by_age ?? mc.percentilesByAge ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([age, p]: [string, any]) => ({
      age: `${age}세`,
      상위10: Math.round((p.p90 ?? 0) / 100000000 * 10) / 10,
      중앙값: Math.round((p.p50 ?? 0) / 100000000 * 10) / 10,
      하위10: Math.round((p.p10 ?? 0) / 100000000 * 10) / 10,
    }))

  const survivalProb = mc.survival_prob_100 ?? mc.survivalProb100 ?? 0
  const depletionProb = mc.depletion_probability ?? mc.depletionProbability ?? 0
  // Monte Carlo 중앙값 고갈 나이 사용 (cashflow 고정수익률보다 현실적)
  const mcDepletionAge = mc.median_depletion_age ?? mc.medianDepletionAge ?? null
  // 백엔드가 전체 시뮬레이션 50번째 백분위수 기준으로 계산 — null이면 중앙 시나리오가 100세 이상 생존
  const depletionSafe = mcDepletionAge === null

  // ── 현황 요약 계산 ──────────────────────────────────────────────────────────
  const totalFinancial = form.financialAssets + form.usStock + form.pensionSavings + form.irp + form.isa
  const usRatio = totalFinancial > 0 ? form.usStock / totalFinancial : 0
  const reRatio = currentAssets > 0 ? (form.realEstateValue - form.realEstateLoan) / currentAssets : 0
  const monthlyIncome = form.nationalPensionMonthly + form.rentalIncomeMonthly
  const monthlyGap = form.monthlyExpense - monthlyIncome

  // 추천 자산 배분 (나이·위험도 기반 주식 비중: 110 - 나이 룰 + 은퇴 여부 조정)
  const isRetired = form.age >= form.retirementAge
  const baseEquity = Math.max(20, Math.min(70, 110 - form.age))
  const targetOverseas = Math.round(baseEquity * 0.5)   // 해외주식
  const targetDomestic = Math.round(baseEquity * 0.2)   // 국내주식·리츠
  const targetBond = Math.round(baseEquity * 0.3)        // 채권·혼합
  const targetCash = 100 - targetOverseas - targetDomestic - targetBond  // 현금·단기

  const statusColor = survivalProb > 0.7 ? '#16a34a' : survivalProb > 0.5 ? '#d97706' : '#dc2626'
  const statusLabel = survivalProb > 0.7 ? '양호' : survivalProb > 0.5 ? '주의 필요' : '즉각 조치 필요'
  const statusBg = survivalProb > 0.7 ? '#f0fdf4' : survivalProb > 0.5 ? '#fffbeb' : '#fef2f2'
  const statusBorder = survivalProb > 0.7 ? '#bbf7d0' : survivalProb > 0.5 ? '#fde68a' : '#fecaca'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── 현황 요약 카드 ── */}
      <div style={{ background: statusBg, border: `1.5px solid ${statusBorder}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: statusColor }}>노후 재정 현황 요약</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: statusColor, padding: '2px 10px', borderRadius: 20 }}>{statusLabel}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[
            { label: '현재 나이 / 은퇴 예정', value: `${form.age}세 / ${form.retirementAge}세`, sub: isRetired ? '이미 은퇴' : `${form.retirementAge - form.age}년 후 은퇴` },
            { label: '현재 총 자산', value: `${won(currentAssets)}원`, sub: `금융 ${won(totalFinancial)}원 · 부동산 ${won(form.realEstateValue - form.realEstateLoan)}원` },
            { label: '월 예상 수입 (은퇴 후)', value: `${won(monthlyIncome)}원/월`, sub: monthlyGap > 0 ? `월 ${won(monthlyGap)}원 부족` : `월 ${won(-monthlyGap)}원 흑자` },
            { label: '100세 생존 확률', value: pct(survivalProb), sub: depletionSafe ? '100세까지 자산 유지' : `${Math.round(mcDepletionAge!)}세 고갈 예상` },
            { label: '해외주식 비중', value: `${Math.round(usRatio * 100)}%`, sub: usRatio > 0.5 ? '⚠️ 과도한 집중' : usRatio > 0.35 ? '관리 범위' : '적정 수준' },
            { label: '부동산 비중', value: `${Math.round(reRatio * 100)}%`, sub: reRatio > 0.7 ? '⚠️ 유동성 위험' : reRatio > 0.55 ? '주의' : '적정 수준' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 3 }}>{item.label}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{item.value}</p>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 추천 자산 배분 카드 ── */}
      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>추천 자산 배분</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4f6ef7', background: '#eff6ff', padding: '2px 10px', borderRadius: 20 }}>{form.age}세 기준 · 110-나이 룰</span>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          {isRetired ? '은퇴 후 인출 단계 — 안정성 우선, 물가상승 대응 주식 비중 유지' : `은퇴까지 ${form.retirementAge - form.age}년 — 성장·안정 균형`}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: '해외주식', pct: targetOverseas, color: '#4f6ef7', bg: '#eff6ff', desc: 'S&P500·선진국 ETF', detail: '성장 엔진, 분산 핵심' },
            { label: '국내주식·리츠', pct: targetDomestic, color: '#7c3aed', bg: '#f5f3ff', desc: 'KOSPI ETF·부동산리츠', detail: '배당·환율 헤지' },
            { label: '채권·혼합', pct: targetBond, color: '#0891b2', bg: '#ecfeff', desc: '국채·회사채 ETF', detail: '변동성 완충' },
            { label: '현금·단기', pct: targetCash, color: '#16a34a', bg: '#f0fdf4', desc: 'CMA·단기채', detail: `${Math.round(form.monthlyExpense * 12 / 10000)}만원/년 생활비 완충` },
          ].map((item) => (
            <div key={item.label} style={{ background: item.bg, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.pct}%</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{item.label}</p>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{item.desc}</p>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.detail}</p>
            </div>
          ))}
        </div>
        {/* 비율 막대 */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 10, marginTop: 16, gap: 2 }}>
          {[
            { pct: targetOverseas, color: '#4f6ef7' },
            { pct: targetDomestic, color: '#7c3aed' },
            { pct: targetBond, color: '#0891b2' },
            { pct: targetCash, color: '#16a34a' },
          ].map((s, i) => (
            <div key={i} style={{ flex: s.pct, background: s.color, borderRadius: 2 }} />
          ))}
        </div>
      </div>

      {/* 핵심 지표 4개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <KPICard
          label="100세 생존 확률"
          value={pct(survivalProb)}
          sub={`자산 고갈 확률 ${pct(depletionProb)}`}
          color={survivalProb > 0.7 ? '#16a34a' : survivalProb > 0.5 ? '#d97706' : '#dc2626'}
          badge={survivalProb > 0.7 ? '안전' : survivalProb > 0.5 ? '주의' : '위험'}
        />
        <KPICard
          label="자산 고갈 예상 (MC 중앙값)"
          value={depletionSafe ? '100세 이상 ✓' : `${Math.round(mcDepletionAge!)}세`}
          sub={depletionSafe ? '100세까지 자산 유지 (중앙 시나리오)' : `${Math.round(mcDepletionAge!)}세에 자산 소진 예상`}
          color={depletionSafe ? '#16a34a' : '#dc2626'}
          badge={depletionSafe ? '안전' : '위험'}
        />
        <KPICard
          label="월 건강보험료"
          value={`${won(hi.monthly_premium ?? hi.monthlyPremium)}원`}
          sub={`장기요양 포함 ${won((hi.total_monthly ?? hi.totalMonthly))}원/월`}
          color="#4f6ef7"
          badge="2026 기준"
        />
        <KPICard
          label={`은퇴 시점 예상 자산 (${form.retirementAge}세)`}
          value={retirementAssets !== null ? `${won(retirementAssets)}원` : '계산 중...'}
          sub={`현재 자산 ${won(currentAssets)}원 기준`}
          color="#7c3aed"
          badge="cashflow 기준"
        />
      </div>

      {/* 건보료 경고 */}
      {(hi.alerts ?? []).length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 12, padding: 16 }}>
          <p style={{ fontWeight: 700, color: '#92400e', marginBottom: 8 }}>⚠️ 건강보험 경고</p>
          {(hi.alerts ?? []).map((a: string, i: number) => (
            <p key={i} style={{ color: '#78350f', fontSize: 14, marginTop: 4 }}>• {a.replace(/⚠️\s*/g, '')}</p>
          ))}
        </div>
      )}

      {/* 현금흐름 차트 */}
      {cfChartData.length > 0 && (
        <ChartCard title="연도별 수입 · 지출 (만원)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cfChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="age" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}만`} />
              <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()}만원`]} />
              <Legend />
              <Bar dataKey="수입" fill="#4f6ef7" radius={[3,3,0,0]} />
              <Bar dataKey="지출" fill="#f87171" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* 몬테카를로 차트 */}
      {mcChartData.length > 0 && (
        <ChartCard title={`자산 생존 시뮬레이션 (억원) — 3,000번 시뮬레이션`}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
            {[
              { color: '#93c5fd', label: '상위 10%' },
              { color: '#4f6ef7', label: '중앙값' },
              { color: '#fca5a5', label: '하위 10%' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 3, background: l.color, borderRadius: 2 }} />
                <span style={{ fontSize: 13, color: '#64748b' }}>{l.label}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={mcChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="age" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}억`} />
              <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}억원`]} />
              <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="상위10" stroke="#93c5fd" fill="#dbeafe" fillOpacity={0.5} strokeWidth={1.5} />
              <Area type="monotone" dataKey="중앙값" stroke="#4f6ef7" fill="transparent" strokeWidth={2.5} />
              <Area type="monotone" dataKey="하위10" stroke="#fca5a5" fill="transparent" strokeWidth={1.5} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* 자산 배분 제안 */}
      <AssetRecommendations result={result} form={form} />

      {/* 연도별 상세 테이블 (10년 단위) */}
      {yearlyData.length > 0 && (
        <ChartCard title="연도별 상세 현금흐름">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['나이', '수입', '지출', '건보료', '세금', '순현금흐름', '총자산'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearlyData
                  .filter((_: any, i: number) => i % 5 === 0)
                  .map((d: any) => {
                    const income = d.total_income ?? d.totalIncome ?? 0
                    const expense = d.total_expense ?? d.totalExpense ?? 0
                    const hi = d.health_insurance ?? d.healthInsurance ?? 0
                    const tax = d.total_tax ?? d.totalTax ?? 0
                    const net = d.net_cashflow ?? d.netCashflow ?? 0
                    const assets = d.total_assets ?? d.totalAssets ?? 0
                    const isNeg = net < 0
                    return (
                      <tr key={d.age} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1e293b' }}>{d.age}세</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16a34a' }}>{won(income)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#dc2626' }}>{won(expense)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{won(hi)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>{won(tax)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: isNeg ? '#dc2626' : '#16a34a' }}>{won(net)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{won(assets)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

    </div>
  )
}

// ── 소형 컴포넌트 ─────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color, badge }: { label: string; value: string; sub: string; color: string; badge: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <p style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{label}</p>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}20`, padding: '2px 8px', borderRadius: 20 }}>{badge}</span>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{value}</p>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{sub}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>{title}</p>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#4f6ef7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>{title}</p>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
      <label style={{ fontSize: 14, color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</label>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Num({ value, onChange, min, max, suffix, step = 1 }: {
  value: number; onChange: any; min?: number; max?: number; suffix?: string; step?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        value={value || ''}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        style={{ ...inputStyle, width: 130, textAlign: 'right' }}
      />
      {suffix && <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>{suffix}</span>}
    </div>
  )
}

// ── 자산 배분 제안 컴포넌트 ────────────────────────────────────────────────────
interface Rec {
  level: 'danger' | 'warning' | 'tip'
  title: string
  detail: string
  action: string
}

function AssetRecommendations({ result, form }: { result: SimResult; form: FormData }) {
  const { mcResult, summary } = result
  const mc = mcResult ?? {}
  const s = summary ?? {}

  const totalFinancial = form.financialAssets + form.usStock + form.pensionSavings + form.irp + form.isa
  const totalAssets = totalFinancial + form.realEstateValue - form.realEstateLoan
  const annualPension = (form.pensionSavings + form.irp) / Math.max(100 - form.retirementAge, 10)
  const annualWithdrawal = form.monthlyExpense * 12
  const survivalProb = mc.survival_prob_100 ?? mc.survivalProb100 ?? 0

  const recs: Rec[] = []

  // 1. 해외주식 집중도
  const usRatio = totalFinancial > 0 ? form.usStock / totalFinancial : 0
  if (usRatio > 0.5) {
    recs.push({
      level: 'danger',
      title: '해외주식 집중 위험',
      detail: `금융자산 중 해외주식 비중이 ${Math.round(usRatio * 100)}%입니다. 환율·시장 충격 시 자산이 동시에 급락할 수 있습니다.`,
      action: '채권(국내·글로벌) 또는 배당주로 20~30%를 분산하세요. 목표: 해외주식 40% 이하',
    })
  } else if (usRatio > 0.35) {
    recs.push({
      level: 'warning',
      title: '해외주식 비중 점검',
      detail: `금융자산 중 해외주식이 ${Math.round(usRatio * 100)}%입니다. 현재는 관리 가능하나 은퇴 후 환율 리스크가 커집니다.`,
      action: '연 1회 리밸런싱으로 해외주식 비중을 30~40% 수준으로 유지하세요.',
    })
  }

  // 2. 부동산 편중
  const reRatio = totalAssets > 0 ? (form.realEstateValue - form.realEstateLoan) / totalAssets : 0
  if (reRatio > 0.7) {
    recs.push({
      level: 'danger',
      title: '부동산 편중 — 현금흐름 위험',
      detail: `총 자산의 ${Math.round(reRatio * 100)}%가 부동산입니다. 유동성이 없어 지출 충격 시 대응이 어렵습니다.`,
      action: '월세 수입 극대화 또는 소형 자산 일부 매각으로 금융자산 3000만원 이상 확보를 검토하세요.',
    })
  } else if (reRatio > 0.55) {
    recs.push({
      level: 'warning',
      title: '부동산 비중 높음',
      detail: `총 자산의 ${Math.round(reRatio * 100)}%가 부동산입니다. 월세 수입이 없으면 현금흐름 적자가 발생할 수 있습니다.`,
      action: '임대 수익 창출 또는 금융자산 비중 점진적 확대를 검토하세요.',
    })
  }

  // 3. 사적연금 분리과세 한도 (연 1,500만원)
  const PENSION_LIMIT = 15_000_000
  if (annualPension > PENSION_LIMIT) {
    recs.push({
      level: 'warning',
      title: '사적연금 분리과세 한도 초과',
      detail: `연 사적연금 인출 예상액 ${won(Math.round(annualPension))}원이 분리과세 한도(1,500만원)를 초과합니다. 초과분은 종합과세 대상이 됩니다.`,
      action: '수령 기간을 늘리거나(예: 35년 수령) IRP와 연금저축 인출을 분산해 연 1,500만원 이하로 조정하세요.',
    })
  }

  // 4. ISA 활용
  if (form.isa < 10_000_000) {
    recs.push({
      level: 'tip',
      title: 'ISA 잔액 부족 — 절세 기회 손실',
      detail: `ISA 잔액이 ${won(form.isa)}원입니다. ISA는 연 2,000만원 납입, 비과세 200만원(서민형 400만원), 만기 후 연금저축 이전 시 추가 세액공제(최대 300만원)를 제공합니다.`,
      action: '매년 ISA에 최대한 납입(연 2,000만원 한도)하고, 3년 만기 후 연금저축으로 이전하세요.',
    })
  } else if (form.isa > 50_000_000) {
    recs.push({
      level: 'tip',
      title: 'ISA → 연금저축 이전 전략',
      detail: `ISA ${won(form.isa)}원을 만기 시 연금저축으로 이전하면 이전액의 10%(최대 300만원)를 추가 세액공제 받을 수 있습니다.`,
      action: 'ISA 만기 시 전액 연금저축으로 이전하세요. 300만원 추가 세액공제 + 비과세 혜택 동시 확보.',
    })
  }

  // 5. 생존 확률 낮음
  if (survivalProb < 0.5) {
    recs.push({
      level: 'danger',
      title: '자산 고갈 위험 — 즉각 조치 필요',
      detail: `100세 생존 확률이 ${Math.round(survivalProb * 100)}%입니다. 현재 지출 수준을 유지하면 절반 이상의 시나리오에서 자산이 바닥납니다.`,
      action: '월 지출을 20~30% 축소하거나, 부동산 자산 일부를 현금화하거나, 국민연금 수령을 최대 70세까지 연기(연 7.2% 증액)하세요.',
    })
  } else if (survivalProb < 0.7) {
    recs.push({
      level: 'warning',
      title: '자산 생존 확률 보통',
      detail: `100세 생존 확률이 ${Math.round(survivalProb * 100)}%입니다. 시장 부진 시나리오에서 자산이 먼저 소진될 수 있습니다.`,
      action: `현금성 자산 6~12개월 생활비(${won(form.monthlyExpense * 6)}~${won(form.monthlyExpense * 12)}원) 확보로 시장 하락 시 인출 최소화.`,
    })
  }

  // 6. 국민연금 연기 전략
  if (form.age < 65 && form.nationalPensionMonthly > 0) {
    recs.push({
      level: 'tip',
      title: '국민연금 연기 수령 검토',
      detail: `국민연금을 65세 대신 70세에 수령하면 월 ${won(Math.round(form.nationalPensionMonthly * 1.36))}원(36% 증액)을 받습니다. 장수 시 총 수령액이 크게 늘어납니다.`,
      action: '건강하고 다른 소득이 있다면 국민연금 5년 연기를 검토하세요. 기대수명 84세 이상이면 연기가 유리합니다.',
    })
  }

  // 7. 현금 완충 부족
  const cashCushion = form.financialAssets
  if (cashCushion < form.monthlyExpense * 12) {
    recs.push({
      level: 'warning',
      title: '현금성 자산 부족',
      detail: `예금·국내 금융자산이 ${won(cashCushion)}원으로 연간 생활비(${won(form.monthlyExpense * 12)}원)에 못 미칩니다. 시장 폭락 시 손실 구간에서 자산을 팔아야 합니다.`,
      action: '금융자산의 일부를 CMA·단기채 등 현금성 자산으로 1~2년치 생활비 규모로 유지하세요.',
    })
  }

  if (recs.length === 0) return null

  const levelColor = { danger: '#dc2626', warning: '#d97706', tip: '#4f6ef7' }
  const levelBg = { danger: '#fef2f2', warning: '#fffbeb', tip: '#eff6ff' }
  const levelBorder = { danger: '#fecaca', warning: '#fde68a', tip: '#bfdbfe' }
  const levelLabel = { danger: '🔴 위험', warning: '🟡 주의', tip: '💡 팁' }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>자산 배분 제안</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {recs.map((r, i) => (
          <div key={i} style={{
            background: levelBg[r.level],
            border: `1px solid ${levelBorder[r.level]}`,
            borderRadius: 10,
            padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: levelColor[r.level], background: `${levelColor[r.level]}18`, padding: '2px 8px', borderRadius: 20 }}>{levelLabel[r.level]}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{r.title}</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 8 }}>{r.detail}</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: levelColor[r.level], whiteSpace: 'nowrap', marginTop: 1 }}>→ 행동</span>
              <p style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, lineHeight: 1.5 }}>{r.action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 14,
  color: '#1e293b',
  background: '#f8fafc',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s',
}
