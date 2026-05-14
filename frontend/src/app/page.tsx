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

  const totalAssets = form.financialAssets + form.usStock + form.pensionSavings + form.irp + form.isa + form.realEstateValue - form.realEstateLoan

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
  const depletionAge = s.depletion_age ?? s.depletionAge

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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
          label="자산 고갈 예상"
          value={depletionAge ? `${depletionAge}세` : '100세 이상 ✓'}
          sub={depletionAge ? `${depletionAge}세에 자산 소진 예상` : '100세까지 자산 유지'}
          color={!depletionAge ? '#16a34a' : '#dc2626'}
          badge={!depletionAge ? '안전' : '위험'}
        />
        <KPICard
          label="월 건강보험료"
          value={`${won(hi.monthly_premium ?? hi.monthlyPremium)}원`}
          sub={`장기요양 포함 ${won((hi.total_monthly ?? hi.totalMonthly))}원/월`}
          color="#4f6ef7"
          badge="2026 기준"
        />
        <KPICard
          label="총 자산"
          value={`${won(totalAssets)}원`}
          sub={`금융 ${won(form.financialAssets + form.usStock)}원 + 부동산 ${won(form.realEstateValue)}원`}
          color="#7c3aed"
          badge="현재"
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
