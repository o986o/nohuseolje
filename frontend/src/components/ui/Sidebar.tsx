'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard, TrendingUp, Calculator, Shield,
  PiggyBank, BarChart3, FileText, Settings, ChevronRight,
} from 'lucide-react'

const NAV = [
  {
    group: '개요',
    items: [
      { href: '/dashboard', label: '대시보드', icon: LayoutDashboard, desc: '전체 현황 요약' },
    ],
  },
  {
    group: '시뮬레이션',
    items: [
      { href: '/simulation/cashflow', label: '현금흐름', icon: TrendingUp, desc: '100세 현금흐름' },
      { href: '/simulation/monte-carlo', label: '몬테카를로', icon: BarChart3, desc: '생존 확률 분석' },
      { href: '/simulation/stress-test', label: '스트레스 테스트', icon: Shield, desc: '시장 폭락 대응' },
    ],
  },
  {
    group: '절세 전략',
    items: [
      { href: '/tax', label: '세금 최적화', icon: Calculator, desc: '세금 최소화 전략' },
      { href: '/tax/gift-estate', label: '증여·상속', icon: FileText, desc: '절세 이전 설계' },
    ],
  },
  {
    group: '연금·건보료',
    items: [
      { href: '/pension', label: '연금 설계', icon: PiggyBank, desc: '인출 최적화' },
      { href: '/health-insurance', label: '건보료 분석', icon: Shield, desc: '건보료 최소화' },
    ],
  },
  {
    group: '설정',
    items: [
      { href: '/onboarding', label: '내 정보 수정', icon: Settings, desc: '프로파일 설정' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* 모바일 탑바 */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
        <span className="text-heading3 font-bold text-brand-600">노후설계</span>
        <span className="text-caption text-neutral-500">한국형 은퇴 운영 플랫폼</span>
      </div>

      {/* 사이드바 */}
      <nav
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-neutral-100 z-40"
        aria-label="사이드바 내비게이션"
      >
        {/* 로고 */}
        <div className="px-6 py-6 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">노</span>
            </div>
            <div>
              <p className="font-bold text-neutral-900 text-body">노후설계</p>
              <p className="text-caption text-neutral-500">은퇴 금융 운영 플랫폼</p>
            </div>
          </div>
        </div>

        {/* 내비게이션 */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {NAV.map((section) => (
            <div key={section.group} className="mb-4">
              <p className="px-3 mb-1 text-caption font-semibold text-neutral-400 uppercase tracking-wider">
                {section.group}
              </p>
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-150 group',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon
                      size={20}
                      className={clsx(
                        'flex-shrink-0',
                        isActive ? 'text-brand-600' : 'text-neutral-400 group-hover:text-neutral-600',
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-body font-medium', isActive && 'font-semibold')}>
                        {item.label}
                      </p>
                      <p className="text-caption text-neutral-400 truncate">{item.desc}</p>
                    </div>
                    {isActive && <ChevronRight size={14} className="text-brand-500" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* 정책 기준 표시 */}
        <div className="px-4 py-4 border-t border-neutral-100">
          <p className="text-caption text-neutral-400 text-center">
            2026년 세법 기준
            <br />
            국민건강보험공단 · 국세청
          </p>
        </div>
      </nav>
    </>
  )
}
