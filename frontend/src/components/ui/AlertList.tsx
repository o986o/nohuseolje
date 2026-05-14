'use client'

import { AlertTriangle, Info, CheckCircle } from 'lucide-react'

interface Props {
  alerts: string[]
  loading?: boolean
}

function classify(alert: string): 'warning' | 'danger' | 'info' {
  if (alert.includes('⚠️') || alert.includes('초과') || alert.includes('적자')) return 'danger'
  if (alert.includes('권장') || alert.includes('절세')) return 'info'
  return 'warning'
}

export function AlertList({ alerts, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-neutral-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!alerts.length) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl text-green-700">
        <CheckCircle size={20} />
        <p className="text-body">현재 특별한 경고 사항이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1" role="list" aria-label="경고 목록">
      {alerts.map((alert, i) => {
        const type = classify(alert)
        const styles = {
          danger:  { bg: 'bg-red-50 border-red-200',   text: 'text-red-800',   Icon: AlertTriangle },
          warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', Icon: AlertTriangle },
          info:    { bg: 'bg-blue-50 border-blue-200',  text: 'text-blue-800',  Icon: Info },
        }[type]

        return (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 border rounded-xl ${styles.bg}`}
            role="listitem"
          >
            <styles.Icon size={18} className={`flex-shrink-0 mt-0.5 ${styles.text}`} />
            <p className={`text-body ${styles.text}`}>
              {alert.replace(/⚠️\s*/g, '')}
            </p>
          </div>
        )
      })}
    </div>
  )
}
