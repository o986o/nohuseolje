import axios from 'axios'
import type {
  HealthInsuranceResult, TaxResult, MonteCarloResult,
  YearlyCashflow, CashflowSummary,
} from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

// snake_case → camelCase 재귀 변환
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}
function keysToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(keysToCamel)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [toCamel(k), keysToCamel(v)])
    )
  }
  return obj
}

export const api = axios.create({
  baseURL: BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// 응답 자동 camelCase 변환
api.interceptors.response.use((res) => {
  res.data = keysToCamel(res.data)
  return res
})

// ── 건보료 ───────────────────────────────────────────────────────────────────
export async function calcHealthInsurance(params: object): Promise<HealthInsuranceResult> {
  const { data } = await api.post('/simulation/health-insurance', params)
  return data
}

export async function projectHealthInsurance(params: object, years = 20): Promise<HealthInsuranceResult[]> {
  const { data } = await api.post(`/simulation/health-insurance/projection?years=${years}`, params)
  return data
}

// ── 세금 ─────────────────────────────────────────────────────────────────────
export async function calcTax(params: object): Promise<TaxResult> {
  const { data } = await api.post('/simulation/tax', params)
  return data
}

export async function getWithdrawalOrder(params: object): Promise<object> {
  const { data } = await api.post('/simulation/tax/withdrawal-order', null, { params })
  return data
}

// ── 몬테카를로 ───────────────────────────────────────────────────────────────
export async function runMonteCarlo(params: object): Promise<MonteCarloResult> {
  const { data } = await api.post('/simulation/monte-carlo', params)
  return data
}

export async function runStressTest(params: object): Promise<Record<string, MonteCarloResult>> {
  const { data } = await api.post('/simulation/monte-carlo/stress-test', params)
  return data
}

export async function compareWithdrawalStrategies(params: object): Promise<Record<string, MonteCarloResult>> {
  const { data } = await api.post('/simulation/monte-carlo/compare-strategies', params)
  return data
}

// ── 현금흐름 ─────────────────────────────────────────────────────────────────
export async function runCashflow(profile: object): Promise<{
  simulation_id: string
  yearly_data: YearlyCashflow[]
  summary: CashflowSummary
}> {
  const { data } = await api.post('/simulation/cashflow/quick', profile)
  return data
}

// ── 연금 최적화 ──────────────────────────────────────────────────────────────
export async function optimizePension(params: object): Promise<object> {
  const { data } = await api.post('/simulation/pension/optimize', params)
  return data
}

// ── 증여/상속세 ──────────────────────────────────────────────────────────────
export async function calcGiftTax(params: object): Promise<object> {
  const { data } = await api.post('/simulation/gift-tax', params)
  return data
}

export async function calcInheritanceTax(params: object): Promise<object> {
  const { data } = await api.post('/simulation/inheritance-tax', params)
  return data
}

export async function analyzeGiftStrategy(params: object): Promise<object> {
  const { data } = await api.post('/simulation/gift-strategy', null, { params })
  return data
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────
export function formatKRW(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return '—'
  if (amount >= 100_000_000) {
    const eok = amount / 100_000_000
    return `${eok.toFixed(1)}억원`
  }
  if (amount >= 10_000) {
    const man = amount / 10_000
    return `${man.toLocaleString('ko-KR')}만원`
  }
  return `${amount.toLocaleString('ko-KR')}원`
}

export function formatPercent(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`
}
