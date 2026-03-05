import { useState } from 'react';

/**
 * Dyfine 사용자 매뉴얼 페이지
 *
 * [Scribe] 제공된 docs/user_manual.md를 기반으로 웹 화면용 컴포넌트 구성
 */
export default function ManualPage() {
    const [selectedSection, setSelectedSection] = useState('1');

    const sections = [
        { id: '1', title: '대시보드', image: '/manual_images/dashboard.png', content: '가산 요약, 현금흐름, 자산 목표 등을 한눈에 확인하는 메인 화면입니다.' },
        { id: '2', title: '거래 내역', image: '/manual_images/transactions.png', content: '모든 수입/지출 내역을 관리합니다. 빠른 추가와 강력한 필터 기능을 제공합니다.' },
        { id: '3', title: '자동 이체', image: '/manual_images/transfers.png', content: '정기적인 이체 규칙을 설정하고 시스템이 감지한 내역을 확정합니다.' },
        { id: '4', title: '예산 관리', image: '/manual_images/budgets.png', content: '월간 지출 한도를 설정하여 계획적인 소비 습관을 만듭니다.' },
        { id: '5', title: '대출 관리', image: '/manual_images/loans.png', content: '은행명, 원금, 금리 이력, 상환 우선순위 등 대출의 모든 것을 관리합니다.' },
        { id: '6', title: '투자 관리', image: '/manual_images/investments.png', content: '보유 종목의 수익률과 월별 자산 변동 스냅샷을 기록합니다.' },
        { id: '7', title: '리포트', image: '/manual_images/reports.png', content: '재정 데이터를 시각화하여 수입/지출 비중과 자산 추이를 분석합니다.' },
        { id: '8', title: '누리무무', image: '/manual_images/petcare.png', content: '반려견 오구의 병원비, 사료, 미용 등 케어 비용을 별도로 기록합니다.' },
        { id: '9', title: '용돈 관리', image: '/manual_images/allowance.png', content: '거래 내역과 연동되어 본인의 용돈 사용 현황을 프라이빗하게 관리합니다.' },
        { id: '10', title: '계좌 관리', image: '/manual_images/accounts.png', content: '은행, 카드, 투자 계좌를 등록하고 실시간 잔액을 확인합니다.' },
        { id: '11', title: '카테고리 관리', image: '/manual_images/categories.png', content: '수입/지출 탭을 구분하여 분류 체계를 자유롭게 설정합니다.' },
        { id: '12', title: '마이 프로필', image: '/manual_images/profile.png', content: '계정 정보 확인, 표시 이름 변경, 그리고 보안을 위한 비밀번호 변경 기능을 제공합니다.' },
    ];

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* 좌측 목차 (사이드바) */}
            <aside className="lg:w-64 flex-shrink-0">
                <div className="sticky top-24 space-y-1">
                    <h2 className="mb-4 text-sm font-semibold text-gray-400 uppercase tracking-wider px-2">목차</h2>
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => setSelectedSection(section.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedSection === section.id
                                ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/30 dark:text-indigo-400'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800'
                                }`}
                        >
                            {section.id}. {section.title}
                        </button>
                    ))}
                </div>
            </aside>

            {/* 우측 본문 */}
            <main className="flex-1 max-w-4xl space-y-12 pb-24">
                <header>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Dyfine 사용자 매뉴얼</h1>
                    <p className="text-gray-500 dark:text-gray-400 italic">
                        작성: [Scribe] | 최종 업데이트: 2026-03-05
                    </p>
                </header>

                {sections.map((section) => (
                    <section
                        key={section.id}
                        id={`section-${section.id}`}
                        className={`space-y-6 scroll-mt-24 ${selectedSection === section.id ? 'block' : 'hidden lg:block'}`}
                    >
                        <div className="border-b border-gray-200 dark:border-zinc-800 pb-2">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {section.id}. {section.title}
                            </h2>
                        </div>

                        <div className="p-1 rounded-2xl bg-gray-100 dark:bg-zinc-800 shadow-inner overflow-hidden border border-gray-200 dark:border-zinc-700">
                            <img
                                src={section.image}
                                alt={section.title}
                                className="w-full rounded-xl shadow-lg"
                                loading="lazy"
                            />
                        </div>

                        <div className="bg-white dark:bg-zinc-950 rounded-xl p-6 border border-gray-100 dark:border-zinc-900 shadow-sm leading-relaxed">
                            <h3 className="text-lg font-semibold mb-4 text-indigo-600 dark:text-indigo-400">🔍 개요 및 주요 기능</h3>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line mb-6">
                                {section.content}
                            </p>

                            {section.id === '9' && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 rounded-r-lg mb-4">
                                    <p className="text-sm text-amber-800 dark:text-amber-300">
                                        <strong>핵심 원리:</strong> 거래 내역에서 "{`{이름}`} 용돈" 카테고리로 기록된 금액이 자동으로 반영됩니다. 본인 데이터만 조회 가능한 프라이빗 기능입니다.
                                    </p>
                                </div>
                            )}

                            {section.id === '12' && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4 rounded-r-lg mb-4">
                                    <p className="text-sm text-blue-800 dark:text-blue-300">
                                        <strong>보안 안내:</strong> 현재 비밀번호를 확인한 후 새 비밀번호를 설정할 수 있습니다.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>
                ))}

                <footer className="pt-12 border-t border-gray-200 dark:border-zinc-800">
                    <p className="text-sm text-gray-500 text-center">
                        Dyfine | 가구 재정의 표준. 더 나은 자산 관리를 위해 지속적으로 업데이트됩니다.
                    </p>
                </footer>
            </main>
        </div>
    );
}
