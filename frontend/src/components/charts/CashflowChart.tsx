'use client'

import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { YearlyCashflow } from '@/types'
import { formatKRW } from '@/lib/api'

interface Props {
  data: YearlyCashflow[]
}

const EOKWON = 100_000_000

function toEok(v: number) {
  return Math.round((v / EOKWON) * 10) / 10
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-card-lg text-body max-w-xs">
      <p className="font-bold text-neutral-900 mb-2">{label}세</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-6 mb-1">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="text-neutral-700">{formatKRW(p.value * EOKWON)}</span>
        </div>
      ))}
    </div>
  )
}

export function CashflowChart({ data }: Props) {
  const chartData = data.map((d) => ({
    age: d.age,
    수입: toEok(d.totalIncome),
    지출: toEok(d.totalExpense),
    순현금흐름: toEok(d.netCashflow),
    총자산: toEok(d.totalAssets),
    세금건보료: toEok(d.totalTax + d.healthInsurance + d.ltcInsurance),
  }))

  return (
    <div>
      <p className="text-caption text-neutral-500 mb-4 text-right">단위: 억원</p>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="age"
            tickFormatter={(v) => `${v}세`}
            tick={{ fontSize: 13, fill: '#64748b' }}
            interval={4}
          />
          <YAxis
            yAxisId="asset"
            orientation="right"
            tickFormatter={(v) => `${v}억`}
            tick={{ fontSize: 13, fill: '#64748b' }}
            width={60}
          />
          <YAxis
            yAxisId="flow"
            orientation="left"
            tickFormatter={(v) => `${v}억`}
            tick={{ fontSize: 13, fill: '#64748b' }}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px', paddingTop: '16px' }}
          />
          <ReferenceLine yAxisId="flow" y={0} stroke="#e2e8f0" strokeWidth={2} />

          <Area
            yAxisId="asset"
            type="monotone"
            dataKey="총자산"
            fill="#e0e9ff"
            stroke="#5e72f5"
            strokeWidth={2}
            fillOpacity={0.4}
            name="총자산"
          />
          <Bar
            yAxisId="flow"
            dataKey="수입"
            fill="#16a34a"
            fillOpacity={0.8}
            name="수입"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            yAxisId="flow"
            dataKey="지출"
            fill="#dc2626"
            fillOpacity={0.7}
            name="지출"
            radius={[2, 2, 0, 0]}
          />
          <Line
            yAxisId="flow"
            type="monotone"
            dataKey="순현금흐름"
            stroke="#d97706"
            strokeWidth={2}
            dot={false}
            name="순현금흐름"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
