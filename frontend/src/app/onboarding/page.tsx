'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { formatKRW } from '@/lib/api'

const schema = z.object({
  birth_year: z.number().min(1930).max(2000),
  gender: z.enum(['male', 'female']),
  retirement_age: z.number().min(50).max(80).default(65),
  has_spouse: z.boolean().default(false),
  employment_status: z.enum(['employed', 'self_employed', 'retired']),
  monthly_salary: z.number().min(0).default(0),
  national_pension_monthly: z.number().min(0).default(0),
  pension_savings_balance: z.number().min(0).default(0),
  irp_balance: z.number().min(0).default(0),
  isa_balance: z.number().min(0).default(0),
  financial_assets: z.number().min(0).default(0),
  us_stock_value: z.number().min(0).default(0),
  real_estate_value: z.number().min(0).default(0),
  real_estate_loan: z.number().min(0).default(0),
  monthly_living_expense: z.number().min(0).default(0),
  risk_tolerance: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
})

type FormData = z.infer<typeof schema>

const STEPS = [
  { id: 1, title: '기본 정보', desc: '나이, 성별, 은퇴 예정 나이' },
  { id: 2, title: '소득 & 연금', desc: '현재 소득과 연금 현황' },
  { id: 3, title: '자산 현황', desc: '금융자산, 부동산, 해외주식' },
  { id: 4, title: '지출 & 목표', desc: '월 생활비와 투자 성향' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [isDone, setIsDone] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      birth_year: 1960,
      retirement_age: 65,
      has_spouse: false,
      employment_status: 'employed',
      monthly_salary: 0,
      national_pension_monthly: 0,
      pension_savings_balance: 0,
      irp_balance: 0,
      isa_balance: 0,
      financial_assets: 0,
      us_stock_value: 0,
      real_estate_value: 0,
      real_estate_loan: 0,
      monthly_living_expense: 3_000_000,
      risk_tolerance: 'moderate',
    },
  })

  const onSubmit = (data: FormData) => {
    console.log('프로파일 저장:', data)
    setIsDone(true)
  }

  if (isDone) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <Check size={40} className="text-green-600" />
        </div>
        <h1 className="text-heading1 font-bold text-neutral-900 mb-3">설정 완료!</h1>
        <p className="text-body-lg text-neutral-600 mb-8">
          입력하신 정보를 바탕으로 은퇴 시뮬레이션을 시작합니다.
        </p>
        <a href="/dashboard" className="btn-primary">
          대시보드로 이동
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-heading1 font-bold text-neutral-900 mb-2">내 정보 입력</h1>
        <p className="text-body-lg text-neutral-500">
          정확한 시뮬레이션을 위해 현재 상황을 입력해 주세요.
        </p>
      </div>

      {/* 단계 표시 */}
      <div className="flex items-center gap-2 mb-8" role="progressbar" aria-valuenow={step} aria-valuemax={STEPS.length}>
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-body flex-shrink-0 ${
                step > s.id
                  ? 'bg-brand-600 text-white'
                  : step === s.id
                  ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500'
                  : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              {step > s.id ? <Check size={16} /> : s.id}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-1 rounded ${step > s.id ? 'bg-brand-500' : 'bg-neutral-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="card-lg">
        <h2 className="text-heading2 font-bold text-neutral-900 mb-1">
          {STEPS[step - 1].title}
        </h2>
        <p className="text-body text-neutral-500 mb-8">{STEPS[step - 1].desc}</p>

        <form onSubmit={handleSubmit(onSubmit)}>
          {step === 1 && <Step1 register={register} errors={errors} />}
          {step === 2 && <Step2 register={register} errors={errors} />}
          {step === 3 && <Step3 register={register} errors={errors} />}
          {step === 4 && <Step4 register={register} errors={errors} />}

          <div className="flex justify-between mt-10">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="btn-secondary"
              >
                <ChevronLeft size={18} />
                이전
              </button>
            ) : (
              <div />
            )}
            {step < STEPS.length ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="btn-primary"
              >
                다음
                <ChevronRight size={18} />
              </button>
            ) : (
              <button type="submit" className="btn-primary">
                시뮬레이션 시작
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function InputGroup({ label, children, error }: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="mb-5">
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-caption text-danger">{error}</p>}
    </div>
  )
}

function Step1({ register, errors }: any) {
  return (
    <div>
      <InputGroup label="출생연도" error={errors.birth_year?.message}>
        <input type="number" className="input" {...register('birth_year', { valueAsNumber: true })}
          min={1930} max={2000} placeholder="예: 1960" />
      </InputGroup>
      <InputGroup label="성별" error={errors.gender?.message}>
        <div className="flex gap-3">
          {[['male', '남성'], ['female', '여성']].map(([v, l]) => (
            <label key={v} className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-neutral-50 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="radio" {...register('gender')} value={v} className="sr-only" />
              <div className="w-5 h-5 rounded-full border-2 border-neutral-300 flex items-center justify-center peer-checked:border-brand-500">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-500 hidden" />
              </div>
              <span className="text-body font-medium">{l}</span>
            </label>
          ))}
        </div>
      </InputGroup>
      <InputGroup label="은퇴 예정 나이">
        <input type="number" className="input" {...register('retirement_age', { valueAsNumber: true })}
          min={50} max={80} />
      </InputGroup>
      <InputGroup label="현재 고용 상태">
        <select className="input" {...register('employment_status')}>
          <option value="employed">직장인 (근로소득자)</option>
          <option value="self_employed">사업자</option>
          <option value="retired">은퇴 (무직)</option>
        </select>
      </InputGroup>
    </div>
  )
}

function Step2({ register, errors }: any) {
  return (
    <div>
      <InputGroup label="월 급여 (세전, 원)">
        <input type="number" className="input" {...register('monthly_salary', { valueAsNumber: true })}
          min={0} step={100000} placeholder="0" />
      </InputGroup>
      <InputGroup label="국민연금 예상 월 수령액 (원)">
        <input type="number" className="input" {...register('national_pension_monthly', { valueAsNumber: true })}
          min={0} step={10000} placeholder="0" />
        <p className="mt-1 text-caption text-neutral-500">국민연금공단 '내 연금 알아보기'에서 확인</p>
      </InputGroup>
      <InputGroup label="연금저축 잔액 (원)">
        <input type="number" className="input" {...register('pension_savings_balance', { valueAsNumber: true })}
          min={0} step={1000000} placeholder="0" />
      </InputGroup>
      <InputGroup label="IRP 잔액 (원)">
        <input type="number" className="input" {...register('irp_balance', { valueAsNumber: true })}
          min={0} step={1000000} placeholder="0" />
      </InputGroup>
      <InputGroup label="ISA 잔액 (원)">
        <input type="number" className="input" {...register('isa_balance', { valueAsNumber: true })}
          min={0} step={1000000} placeholder="0" />
      </InputGroup>
    </div>
  )
}

function Step3({ register, errors }: any) {
  return (
    <div>
      <InputGroup label="금융자산 총액 (원)" error={errors.financial_assets?.message}>
        <input type="number" className="input" {...register('financial_assets', { valueAsNumber: true })}
          min={0} step={10000000} placeholder="0" />
        <p className="mt-1 text-caption text-neutral-500">예금, 적금, 펀드, 국내주식 등</p>
      </InputGroup>
      <InputGroup label="해외주식 평가액 (원)">
        <input type="number" className="input" {...register('us_stock_value', { valueAsNumber: true })}
          min={0} step={10000000} placeholder="0" />
        <p className="mt-1 text-caption text-neutral-500">미국주식 ETF 포함</p>
      </InputGroup>
      <InputGroup label="부동산 시세 (원)">
        <input type="number" className="input" {...register('real_estate_value', { valueAsNumber: true })}
          min={0} step={10000000} placeholder="0" />
      </InputGroup>
      <InputGroup label="부동산 대출 잔액 (원)">
        <input type="number" className="input" {...register('real_estate_loan', { valueAsNumber: true })}
          min={0} step={10000000} placeholder="0" />
      </InputGroup>
    </div>
  )
}

function Step4({ register, errors }: any) {
  return (
    <div>
      <InputGroup label="월 생활비 (원)">
        <input type="number" className="input" {...register('monthly_living_expense', { valueAsNumber: true })}
          min={0} step={100000} placeholder="3000000" />
        <p className="mt-1 text-caption text-neutral-500">식비, 교통, 문화활동 등 전체 생활비</p>
      </InputGroup>
      <InputGroup label="투자 성향">
        <div className="space-y-3">
          {[
            ['conservative', '안정형', '원금 보전 우선, 예금·채권 중심'],
            ['moderate', '안정성장형', '안전자산과 성장자산 균형'],
            ['aggressive', '성장형', '높은 수익 추구, 주식 비중 높음'],
          ].map(([v, l, d]) => (
            <label key={v} className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-neutral-50 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="radio" {...register('risk_tolerance')} value={v} className="mt-1" />
              <div>
                <p className="text-body font-semibold">{l}</p>
                <p className="text-caption text-neutral-500">{d}</p>
              </div>
            </label>
          ))}
        </div>
      </InputGroup>
    </div>
  )
}
