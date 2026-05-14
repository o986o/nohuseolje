'use client'

import { useState } from 'react'

const SECTIONS = [
  {
    id: 'withdrawal',
    icon: '💰',
    title: '연금 인출 최적화',
    subtitle: '세금을 최소화하는 순서와 타이밍',
    color: '#4f6ef7',
    cards: [
      {
        title: '연금 인출 세율표 (2026)',
        content: [
          { label: '55~69세 수령', value: '5.5% 분리과세', note: '가장 불리한 구간' },
          { label: '70~79세 수령', value: '4.4% 분리과세', note: '10% 감면' },
          { label: '80세 이상 수령', value: '3.3% 분리과세', note: '40% 감면' },
          { label: '연 1,200만원 초과', value: '종합소득세 합산', note: '고소득자 위험' },
        ],
        tip: '⚡ 핵심 전략: 연금저축 + IRP 합산 연 1,200만원 이내로 인출하면 분리과세 적용. 초과분은 최고 45%까지 과세될 수 있으므로 ISA 만기자금으로 보완하세요.',
      },
      {
        title: '최적 인출 순서',
        steps: [
          { step: '1순위', label: 'ISA 만기 인출', reason: '비과세 한도 200만원(서민형 400만원), 초과분 9.9% 분리과세 — 가장 유리' },
          { step: '2순위', label: '해외주식 ETF 배당', reason: '연 250만원 기본공제 후 22% 단일세율 — 금융소득종합과세 무관' },
          { step: '3순위', label: '연금저축·IRP 인출', reason: '80세 이후 3.3%로 가급적 미루되, 연 1,200만원 한도 준수' },
          { step: '4순위', label: '국민연금', reason: '수령 시기를 70세까지 연기하면 월 36% 증가 — 연기연금 전략' },
        ],
      },
    ],
  },
  {
    id: 'health',
    icon: '🏥',
    title: '건강보험료 최소화',
    subtitle: '지역가입자 건보료 절감 핵심 전략',
    color: '#16a34a',
    cards: [
      {
        title: '지역가입자 건보료 구성 (2026)',
        content: [
          { label: '소득 보험료', value: '8.09%', note: '소득월액에 적용' },
          { label: '재산 보험료', value: '5.09등급 기준', note: '공시가 기준 재산점수' },
          { label: '자동차 보험료', value: '4,000cc이상 등', note: '고급차는 별도 부과' },
          { label: '장기요양보험료', value: '건보료의 12.95%', note: '별도 추가' },
        ],
        tip: '⚡ 절세 포인트: 금융소득은 연 2,000만원 초과분부터 건보료 부과 대상. ISA·비과세 상품 활용 시 과세 소득 자체를 줄일 수 있습니다.',
      },
      {
        title: '건보료 절감 체크리스트',
        checks: [
          { ok: true, item: 'ISA 활용', detail: '이자·배당소득을 ISA 안에 묶으면 금융소득 건보료 부과 제외' },
          { ok: true, item: '배우자 피부양자 등록', detail: '배우자 소득 연 2,000만원 이하 + 재산 5.4억 이하면 무보험료 피부양자 가능' },
          { ok: true, item: '국민연금 조기 수령 주의', detail: '국민연금 수령액이 높으면 지역가입자 소득 보험료 증가' },
          { ok: false, item: '고가 자동차 보유', detail: '1,600cc 초과 자동차는 건보료 재산에 포함 — 고급차 처분 고려' },
          { ok: false, item: '임대소득 미신고', detail: '2,000만원 이하 주택임대소득도 분리과세 신고 시 소득공제 적용 가능' },
        ],
      },
    ],
  },
  {
    id: 'tax',
    icon: '📋',
    title: '금융소득종합과세 방어',
    subtitle: '연 2,000만원 한도 관리와 분산 전략',
    color: '#d97706',
    cards: [
      {
        title: '금융소득종합과세 기준 (2026)',
        content: [
          { label: '과세 기준', value: '연 2,000만원', note: '이자+배당 합산' },
          { label: '2,000만원 이하', value: '15.4% 분리과세', note: '종합소득세 합산 없음' },
          { label: '2,000만원 초과', value: '종합소득세 합산', note: '최고 45%+지방세 적용' },
          { label: '건보료 추가', value: '초과분에 8.09%', note: '이중 부담' },
        ],
        tip: '⚡ 임계점 관리: 금융소득이 2,000만원에 근접하면 ISA로 이동하거나, 배우자에게 증여 후 투자해 소득분산을 노리세요.',
      },
      {
        title: '해외주식 절세 전략',
        content: [
          { label: '기본 세율', value: '22% (양도세)', note: '국내주식과 달리 분리과세' },
          { label: '기본공제', value: '연 250만원', note: '매년 활용 필수' },
          { label: '손실 상계', value: '동일 연도 내 가능', note: '연말 손실 확정 매도 전략' },
          { label: 'ISA 내 ETF', value: '비과세 or 9.9%', note: '해외지수 ETF를 ISA에서 운용' },
        ],
        tip: '⚡ 연말 절세: 평가손실 중인 해외주식을 12월에 매도→재매수하면 손실을 확정해 250만원 기본공제 외에 추가 손익통산 가능.',
      },
    ],
  },
  {
    id: 'isa',
    icon: '🏦',
    title: 'ISA → 연금 이전 전략',
    subtitle: '최강의 세제혜택 루트',
    color: '#7c3aed',
    cards: [
      {
        title: 'ISA 기본 구조 (2026)',
        content: [
          { label: '납입 한도', value: '연 2,000만원', note: '미납 한도 이월 가능' },
          { label: '의무 가입 기간', value: '3년', note: '이후 자유롭게 만기 설정' },
          { label: '비과세 한도', value: '200만원 (서민형 400만원)', note: '초과분 9.9% 분리과세' },
          { label: '금융소득종합과세', value: '해당 없음', note: 'ISA 내부 수익은 기준 외' },
        ],
        tip: '⚡ ISA는 과세 이연 + 분리과세의 이중 혜택. 은퇴 후 자금을 ISA에 묻어두고 3년마다 인출 사이클을 돌리면 건보료·종합과세 모두 방어 가능.',
      },
      {
        title: 'ISA→연금저축 이전 혜택',
        steps: [
          { step: '만기 후', label: 'ISA 해지', reason: '만기 자금 전액(또는 일부)을 60일 이내 연금계좌로 이전' },
          { step: '추가 혜택', label: '세액공제 추가 10%', reason: 'ISA 이전금액의 10%(최대 300만원)를 세액공제 추가 적용' },
          { step: '납입 한도', label: '연금저축 한도 초과 가능', reason: 'ISA 이전은 일반 납입 한도(600만원)와 별도로 처리' },
          { step: '운용 기간', label: '연금 계좌에서 장기 운용', reason: '55세 이후 연금 형태로 분리과세(3.3~5.5%) 인출' },
        ],
      },
    ],
  },
  {
    id: 'gift',
    icon: '🏠',
    title: '배우자 증여 절세',
    subtitle: '6억원 공제 활용과 취득가액 승계',
    color: '#0891b2',
    cards: [
      {
        title: '배우자 증여 공제 한도',
        content: [
          { label: '배우자 증여 공제', value: '6억원 (10년 합산)', note: '2026년 기준' },
          { label: '직계존비속', value: '5,000만원', note: '미성년자 2,000만원' },
          { label: '기타 친족', value: '1,000만원', note: '6촌 이내 혈족' },
          { label: '증여세 신고', value: '3개월 이내', note: '신고 시 3% 공제 혜택' },
        ],
        tip: '⚡ 취득가액 승계 효과: 배우자에게 주식을 증여하면 수증자의 취득가액이 증여 시점 시가로 재설정됩니다. 평가이익이 큰 해외주식을 6억 내에서 증여하면 양도세 절감 효과가 큽니다.',
      },
      {
        title: '증여 전략 시나리오',
        steps: [
          { step: '1단계', label: '해외주식 배우자 증여', reason: '취득가액 리셋으로 향후 양도세 22% 절감 — 6억 공제 범위 내' },
          { step: '2단계', label: '10년 후 재증여', reason: '10년마다 6억 공제 리셋 — 부부간 지속적 자산 이전' },
          { step: '3단계', label: '배우자 명의 ISA 납입', reason: '금융소득 분산으로 2,000만원 한도 배우자별 적용' },
          { step: '주의', label: '우회 증여 금지', reason: '증여 후 즉각 매도 → 증여세 회피로 간주될 수 있음. 최소 수개월 보유 권장' },
        ],
      },
    ],
  },
  {
    id: 'ltc',
    icon: '👴',
    title: '장기요양 리스크 대비',
    subtitle: '100세 시대 필수 리스크 관리',
    color: '#dc2626',
    cards: [
      {
        title: '장기요양 비용 현실',
        content: [
          { label: '요양원 입소 비용', value: '월 80~150만원', note: '본인 부담 20%+식비' },
          { label: '재가 요양 서비스', value: '월 40~80만원', note: '방문요양, 목욕 등' },
          { label: '인지증(치매) 치료비', value: '월 200만원+', note: '전문 치매 시설 기준' },
          { label: '평균 요양 기간', value: '3~7년', note: '총 비용 1~5억 예상' },
        ],
        tip: '⚡ 현금흐름 설계: 75세 이후 의료비·요양비가 급증합니다. 현금흐름 시뮬레이션에서 80세+ 구간의 "의료비 인플레이션 4%"를 반드시 확인하세요.',
      },
      {
        title: '장기요양 대비 전략',
        checks: [
          { ok: true, item: '장기요양보험 수급 자격 확인', detail: '65세 이상 1~5등급 판정 시 국가 서비스 지원 — 요양원 입소비 급격히 감소' },
          { ok: true, item: '민간 치매보험 가입', detail: '55~65세 가입 시 보험료 부담 적음. 치매 진단비 + 요양비 보장' },
          { ok: true, item: '유동 현금 2년치 준비', detail: '언제든 요양비 지출 가능한 단기 유동성 자산 별도 보유' },
          { ok: false, item: '부동산 100% 집중', detail: '유동성 없는 자산만 보유 시 요양비 마련에 큰 어려움. 금융자산 병행 필수' },
        ],
      },
    ],
  },
  {
    id: 'pension',
    icon: '📅',
    title: '국민연금 수령 시기 최적화',
    subtitle: '연기 vs 조기수령 손익 분기점',
    color: '#0d9488',
    cards: [
      {
        title: '국민연금 수령 시기별 비교',
        content: [
          { label: '조기수령 (60세)', value: '-30%', note: '5년 앞당기면 30% 삭감' },
          { label: '정상수령 (63~65세)', value: '기준 100%', note: '2033년까지 65세로 단계 인상' },
          { label: '연기수령 (70세)', value: '+36%', note: '1년 연기당 7.2% 증가' },
          { label: '손익분기점', value: '약 79세', note: '연기 시 이득이 되는 나이' },
        ],
        tip: '⚡ 연기 전략: 건강하고 다른 소득원이 있다면 70세까지 연기하면 평생 36% 많이 받습니다. 단, 연기하는 동안 국민연금 소득이 없어 건보료는 금융소득 기준으로만 부과되어 오히려 절감 효과도 있습니다.',
      },
      {
        title: '수령 시기 결정 체크리스트',
        checks: [
          { ok: true, item: '건강 상태 양호', detail: '기대수명 85세 이상 예상 시 연기수령이 유리' },
          { ok: true, item: '다른 소득원 확보', detail: '연기 기간 중 생활비를 충당할 금융자산·임대소득 필수' },
          { ok: false, item: '건강 이슈 있음', detail: '기대수명 단축 우려 시 조기수령 또는 정상수령이 유리' },
          { ok: false, item: '소득 공백 있음', detail: '연기 기간 수입이 없으면 자산 고갈 위험 — 시뮬레이션으로 확인 필수' },
        ],
      },
    ],
  },
  {
    id: 'crash',
    icon: '📉',
    title: '폭락장 대응 전략',
    subtitle: '순서효과(Sequence of Returns Risk) 대비',
    color: '#7c3aed',
    cards: [
      {
        title: '순서효과(SORR)란?',
        content: [
          { label: '개념', value: '은퇴 초기 폭락 = 치명적', note: '인출하면서 떨어진 주식은 회복 불가' },
          { label: '예시', value: '65세에 -40% 하락', note: '5년 후 +70% 회복해도 원금 복구 불가능' },
          { label: '몬테카를로 반영', value: 'GARCH + 레짐스위칭', note: '본 시뮬레이터에 반영됨' },
          { label: '하위 10% 시나리오', value: '차트에서 붉은 선 확인', note: '이 선이 0 아래로 가면 자산 고갈' },
        ],
        tip: '⚡ 자산 생존 시뮬레이션의 하위 10% 선(붉은 점선)이 중요합니다. 이 시나리오에서도 자산이 버티려면 현금·채권 비중을 높이거나 지출을 줄여야 합니다.',
      },
      {
        title: '폭락장 대응 행동 지침',
        steps: [
          { step: '사전 준비', label: '현금 쿠션 2~3년치 확보', reason: '폭락 시 주식을 매도하지 않고 현금에서 지출 → SORR 방어' },
          { step: '리밸런싱', label: '연 1회 자산 배분 조정', reason: '상승한 자산을 팔고 하락한 자산 매수 — 규율 있는 리밸런싱' },
          { step: '폭락 시', label: 'Guardrails 전략 적용', reason: '인출을 10% 줄이는 Guardrails로 포트폴리오 생존율 대폭 상승' },
          { step: '회복 시', label: '추가 인출 또는 재투자', reason: '포트폴리오 회복 후 상한선 초과 시 인출 10% 증가 — 유연한 생활비 조정' },
        ],
      },
    ],
  },
]

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState<string | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <header style={{ background: '#1e293b', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#4f6ef7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>노</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>노후설계</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>2026년 세법 · 건보료 기준</div>
          </div>
        </div>
        <a href="/" style={{ fontSize: 14, color: '#93c5fd', fontWeight: 600, textDecoration: 'none', padding: '8px 16px', border: '1px solid #334155', borderRadius: 8 }}>
          ← 시뮬레이터로 돌아가기
        </a>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>
            📚 노후설계 완전 가이드
          </h1>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 600, margin: '0 auto' }}>
            2026년 세법·건보료 기준. 연금 인출부터 건보료 절감, 폭락장 대응까지 — 실전 전략을 정리했습니다.
          </p>
        </div>

        {/* 섹션 네비게이션 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
              style={{
                padding: '8px 16px', border: `2px solid ${activeSection === s.id ? s.color : '#e2e8f0'}`,
                borderRadius: 24, background: activeSection === s.id ? `${s.color}15` : '#fff',
                color: activeSection === s.id ? s.color : '#475569',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {s.icon} {s.title}
            </button>
          ))}
          {activeSection && (
            <button
              onClick={() => setActiveSection(null)}
              style={{ padding: '8px 16px', border: '2px solid #e2e8f0', borderRadius: 24, background: '#fff', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}
            >
              전체 보기
            </button>
          )}
        </div>

        {/* 섹션 카드들 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {SECTIONS.filter(s => !activeSection || s.id === activeSection).map(section => (
            <div key={section.id} style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div style={{ background: section.color, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 36 }}>{section.icon}</div>
                <div>
                  <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{section.title}</h2>
                  <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{section.subtitle}</p>
                </div>
              </div>

              <div style={{ padding: 28, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {section.cards.map((card, ci) => (
                  <div key={ci} style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${section.color}30` }}>
                      {card.title}
                    </h3>

                    {'content' in card && card.content && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {card.content.map((row, ri) => (
                          <div key={ri} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: 14, color: '#64748b', flex: 1 }}>{row.label}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: section.color, margin: '0 12px', whiteSpace: 'nowrap' }}>{row.value}</span>
                            <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{row.note}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {'steps' in card && card.steps && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {card.steps.map((s, si) => (
                          <div key={si} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: si % 2 === 0 ? '#f8fafc' : '#fff', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: section.color, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 2 }}>
                              {s.step}
                            </span>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{s.label}</p>
                              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{s.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {'checks' in card && card.checks && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {card.checks.map((c, ci2) => (
                          <div key={ci2} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: c.ok ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${c.ok ? '#bbf7d0' : '#fecaca'}` }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>{c.ok ? '✅' : '❌'}</span>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, color: c.ok ? '#166534' : '#991b1b', marginBottom: 2 }}>{c.item}</p>
                              <p style={{ fontSize: 13, color: c.ok ? '#15803d' : '#b91c1c', lineHeight: 1.4 }}>{c.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {'tip' in card && card.tip && (
                      <div style={{ marginTop: 16, padding: '14px 16px', background: `${section.color}10`, borderLeft: `4px solid ${section.color}`, borderRadius: '0 10px 10px 0' }}>
                        <p style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{card.tip}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 면책 공지 */}
        <div style={{ marginTop: 40, padding: '20px 24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
            ⚠️ <strong>주의사항</strong>: 본 가이드는 2026년 세법·건보료 제도를 기반으로 한 교육 목적의 정보입니다.
            실제 세무 신고·보험료 산정은 개인 상황에 따라 달라질 수 있으므로 세무사·FP 전문가와 상담하시기 바랍니다.
            법령 개정에 따라 수치가 변경될 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
