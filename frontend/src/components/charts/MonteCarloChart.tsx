'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { formatKRW } from '@/lib/api'

interface Props {
  data: Record<number, { p10: number; p25: number; p50: number; p75: number; p90: number }>
  currentAge: number
}

const EOKWON = 100_000_000

export function MonteCarloChart({ data, currentAge }: Props) {
  const chartData = Object.entries(data)
    .map(([age, pcts]) => ({
      age: Number(age),
      p90: Math.round(pcts.p90 / EOKWON * 10) / 10,
      p75: Math.round(pcts.p75 / EOKWON * 10) / 10,
      p50: Math.round(pcts.p50 / EOKWON * 10) / 10,
      p25: Math.round(pcts.p25 / EOKWON * 10) / 10,
      p10: Math.round(pcts.p10 / EOKWON * 10) / 10,
    }))
    .sort((a, b) => a.age - b.age)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-card-lg text-body">
        <p className="font-bold text-neutral-900 mb-2">{label}세</p>
        {[
          { key: 'p90', label: '상위 10%', color: '#5e72f5' },
          { key: 'p50', label: '중앙값',   color: '#16a34a' },
          { key: 'p10', label: '하위 10%', color: '#dc2626' },
        ].map(({ key, label: l, color }) => {
          const item = payload.find((p: any) => p.dataKey === key)
          return item ? (
            <div key={key} className="flex justify-between gap-6 mb-1">
              <span style={{ color }} className="font-medium">{l}</span>
              <span>{item.value}억원</span>
            </div>
          ) : null
        })}
      </div>
    )
  }

  return (
    <div>
      <p className="text-caption text-neutral-500 mb-2">
        10,000번 시뮬레이션 기준 · 단위: 억원
      </p>
      <div className="flex gap-6 mb-4">
        <LegendItem color="#c7d7fe" label="상위 25~75% 구간" />
        <LegendItem color="#5e72f5" label="중앙값 (P50)" />
        <LegendItem color="#dc2626" label="하위 10% (최악 시나리오)" />
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="age"
            tickFormatter={(v) => `${v}세`}
            tick={{ fontSize: 13, fill: '#64748b' }}
            interval={4}
          />
          <YAxis
            tickFormatter={(v) => `${v}억`}
            tick={{ fontSize: 13, fill: '#64748b' }}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={2} />

          {/* P25~P75 구간 (신뢰 구간) */}
          <Area
            type="monotone"
            dataKey="p75"
            stroke="transparent"
            fill="#c7d7fe"
            fillOpacity={0.6}
            name="75백분위"
          />
          <Area
            type="monotone"
            dataKey="p25"
            stroke="transparent"
            fill="#ffffff"
            fillOpacity={1}
            name="25백분위"
          />

          {/* P90 */}
          <Area
            type="monotone"
            dataKey="p90"
            stroke="#a5bcfc"
            strokeWidth={1}
            fill="transparent"
            strokeDasharray="4 2"
            name="90백분위"
          />
          {/* P50 중앙값 */}
          <Area
            type="monotone"
            dataKey="p50"
            stroke="#5e72f5"
            strokeWidth={3}
            fill="transparent"
            name="중앙값"
          />
          {/* P10 최악 */}
          <Area
            type="monotone"
            dataKey="p10"
            stroke="#dc2626"
            strokeWidth={2}
            fill="transparent"
            strokeDasharray="4 2"
            name="10백분위"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-caption text-neutral-600">{label}</span>
    </div>
  )
}
