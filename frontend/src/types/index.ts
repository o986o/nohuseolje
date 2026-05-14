// ── 사용자 프로파일 ──────────────────────────────────────────────────────────
export interface UserProfile {
  id: string
  userId: string
  birthYear: number
  birthMonth?: number
  gender: 'male' | 'female'
  retirementAge: number
  targetDeathAge: number
  residenceType: 'employee' | 'regional'
  hasSpouse: boolean
  spouseBirthYear?: number
  spouseGender?: 'male' | 'female'
  spouseIncomeMonthly: number
  dependentsCount: number
  employmentStatus: 'employed' | 'self_employed' | 'retired'
  monthlySalary: number
  businessIncomeAnnual: number
  otherIncomeAnnual: number
  totalFinancialAssets: number
  domesticStock: number
  usStock: number
  otherOverseasStock: number
  bonds: number
  cashDeposits: number
  realEstateValue: number
  realEstateLoan: number
  otherAssets: number
  nationalPensionMonthly: number
  pensionSavingsBalance: number
  irpBalance: number
  isaBalance: number
  companyPensionBalance: number
  pensionStartAge: number
  monthlyLivingExpense: number
  monthlyMedicalExpense: number
  monthlyHousingExpense: number
  targetMonthlyExpense: number
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
}

// ── 현금흐름 ─────────────────────────────────────────────────────────────────
export interface YearlyCashflow {
  year: number
  age: number
  totalIncome: number
  totalExpense: number
  netCashflow: number
  totalAssets: number
  nationalPension: number
  privatePension: number
  financialIncome: number
  healthInsurance: number
  ltcInsurance: number
  longTermCareCost: number
  totalTax: number
  alerts: string[]
  isCashflowNegative: boolean
  isAssetsDepleted: boolean
}

export interface CashflowSummary {
  depletionAge: number | null
  survivedToAge: number
  totalLifetimeIncome: number
  totalLifetimeTax: number
  totalLifetimeHealthInsurance: number
  totalLifetimeExpense: number
  peakAssetsAge: number
  peakAssets: number
  finalAssets: number
  negativeCashflowYears: number
  firstNegativeAge: number | null
  avgAnnualTax: number
  avgAnnualHealthInsurance: number
}

// ── 건보료 ───────────────────────────────────────────────────────────────────
export interface HealthInsuranceResult {
  subscriberType: string
  monthlyPremium: number
  annualPremium: number
  ltcPremiumMonthly: number
  totalMonthly: number
  totalAnnual: number
  incomePremium: number
  propertyPremium: number
  vehiclePremium: number
  isDependentEligible: boolean
  dependentDisqualificationReasons: string[]
  dependencyRiskScore: number
  alerts: string[]
}

// ── 세금 ─────────────────────────────────────────────────────────────────────
export interface TaxResult {
  totalTaxableIncome: number
  incomeTax: number
  localIncomeTax: number
  totalIncomeTax: number
  financialIncomeWithholding: number
  overseasStockTax: number
  pensionTax: number
  isaTax: number
  pensionTaxCredit: number
  totalTax: number
  effectiveTaxRate: number
  comprehensiveVsSeparate: {
    financialIncome: number
    comprehensiveTax: number
    separateTax: number
    recommended: string
  }
  optimizationSuggestions: string[]
  alerts: string[]
}

// ── 몬테카를로 ───────────────────────────────────────────────────────────────
export interface MonteCarloResult {
  numSimulations: number
  years: number
  survivalProbTargetAge: number
  survivalProb90: number
  survivalProb95: number
  survivalProb100: number
  depletionProbability: number
  medianDepletionAge: number | null
  expectedDepletionAge: number | null
  percentilesByAge: Record<number, {
    p10: number; p25: number; p50: number; p75: number; p90: number
  }>
  finalAssetsP10: number
  finalAssetsP25: number
  finalAssetsP50: number
  finalAssetsP75: number
  finalAssetsP90: number
  medianAnnualWithdrawal: number
  minAnnualWithdrawal: number
}

// ── 대시보드 요약 ─────────────────────────────────────────────────────────────
export interface DashboardSummary {
  survivalProbability100: number
  depletionAge: number | null
  stableMonthlyWithdrawal: number
  totalLifetimeTax: number
  totalLifetimeHealthInsurance: number
  inflationAdjustedExpense: number
  ltcRiskScore: number
  stressTestScore: number
}

// ── API 요청 타입 ─────────────────────────────────────────────────────────────
export interface AssetAllocation {
  us_stock: number
  kr_stock: number
  bond: number
  cash: number
  real_estate: number
  reits: number
  global_bond: number
}

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'
export type SubscriberType = 'employee' | 'regional' | 'dependent'
export type WithdrawalStrategy = 'fixed' | 'guardrails' | 'vpw' | 'floor_ceiling'
