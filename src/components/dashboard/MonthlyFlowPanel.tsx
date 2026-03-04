import { useMemo } from 'react';
import { CashFlowForecast, LoanPaymentDetail } from '@/hooks/queries/useCashFlowForecast';

/**
 * 통합 월별 현금흐름 패널 (MonthlyFlowPanel)
 *
 * [PM] 엑셀 "덕선이네 수입/지출/저축" 시트를 그대로 재현하는 패널입니다.
 * 수입 → 대출상환 → 고정지출 → 변동예산 → 가용자금(FRS) 파이프라인을
 * 한 눈에 보여주어, 대출 상환 여력과 투자 가용 자금을 바로 파악할 수 있습니다.
 *
 * [Designer] 미니멀한 리스트형 레이아웃으로, 확장/축소가 가능한 섹션 구성.
 * 색상 코딩: 수입(파랑), 지출(빨강/회색), 가용(초록)
 */

interface MonthlyFlowPanelProps {
    /** useCashFlowForecast 훅의 반환 데이터 */
    forecast: CashFlowForecast | null | undefined;
    /** 현재 선택된 월 (표시용) */
    yearMonth?: string;
}

/** 개별 행 렌더링 헬퍼 */
function FlowRow({ label, amount, indent = false, color = 'default' }: {
    label: string;
    amount: number;
    indent?: boolean;
    color?: 'income' | 'expense' | 'frs' | 'default' | 'loan';
}) {
    // 금액 색상 구분
    const colorClass = {
        income: 'text-blue-600 dark:text-blue-400',
        expense: 'text-red-600 dark:text-red-400',
        loan: 'text-orange-600 dark:text-orange-400',
        frs: 'text-emerald-600 dark:text-emerald-400 font-bold',
        default: 'text-gray-900 dark:text-white',
    }[color];

    return (
        <div className={`flex items-center justify-between py-1.5 ${indent ? 'pl-6' : ''}`}>
            <span className={`text-sm ${indent ? 'text-gray-500 dark:text-gray-400' : 'font-medium text-gray-700 dark:text-gray-200'}`}>
                {indent ? '├ ' : ''}{label}
            </span>
            <span className={`text-sm tabular-nums ${colorClass}`}>
                ₩{Math.abs(amount).toLocaleString()}
            </span>
        </div>
    );
}

/** 섹션 헤더 + 합계 행 */
function FlowSection({ emoji, title, total, color, children }: {
    emoji: string;
    title: string;
    total: number;
    color: 'income' | 'expense' | 'frs' | 'loan';
    children?: React.ReactNode;
}) {
    const colorClass = {
        income: 'text-blue-700 dark:text-blue-400',
        expense: 'text-red-700 dark:text-red-400',
        loan: 'text-orange-700 dark:text-orange-400',
        frs: 'text-emerald-700 dark:text-emerald-400',
    }[color];

    const bgClass = {
        income: 'bg-blue-50 dark:bg-blue-900/10',
        expense: 'bg-red-50 dark:bg-red-900/10',
        loan: 'bg-orange-50 dark:bg-orange-900/10',
        frs: 'bg-emerald-50 dark:bg-emerald-900/10',
    }[color];

    return (
        <div className="mb-1">
            {/* 섹션 헤더 (합계) */}
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${bgClass}`}>
                <span className={`text-sm font-semibold ${colorClass}`}>{emoji} {title}</span>
                <span className={`text-sm font-bold tabular-nums ${colorClass}`}>
                    ₩{Math.abs(total).toLocaleString()}
                </span>
            </div>
            {/* 하위 항목 */}
            {children && (
                <div className="px-3">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function MonthlyFlowPanel({ forecast, yearMonth }: MonthlyFlowPanelProps) {
    // FRS 분배 계획 (현재는 단순 비율로 표시, 추후 설정 가능하게 확장 가능)
    const frsAllocation = useMemo(() => {
        if (!forecast || forecast.freeRouteSpace <= 0) return null;
        const frs = forecast.freeRouteSpace;
        return {
            savings: Math.round(frs * 0.3),      // 30% 저축/비상금
            investment: Math.round(frs * 0.5),    // 50% 투자
            extraRepay: Math.round(frs * 0.2),    // 20% 추가 대출상환
        };
    }, [forecast]);

    if (!forecast) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400 dark:border-zinc-800 dark:bg-zinc-950">
                현금흐름 데이터를 불러오는 중...
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {/* 패널 헤더 */}
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    📊 {yearMonth || '이번 달'} 현금흐름
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">수입 → 대출 → 지출 → 가용자금 파이프라인</p>
            </div>

            <div className="p-4 space-y-1">
                {/* 1. 수입 */}
                <FlowSection emoji="💰" title="수입 합계" total={forecast.fixedIncome} color="income">
                    <FlowRow label="고정 수입 (자동이체 기반)" amount={forecast.fixedIncome} indent color="income" />
                </FlowSection>

                {/* 구분선 */}
                <div className="border-t border-dashed border-gray-200 dark:border-zinc-800 my-2" />

                {/* 2. 대출 상환 */}
                <FlowSection emoji="🏦" title="대출 상환 합계" total={forecast.totalLoanPayment} color="loan">
                    {forecast.loanPayments.map((lp: LoanPaymentDetail) => (
                        <FlowRow
                            key={lp.loanId}
                            label={`${lp.loanName} (${(lp.annualRate * 100).toFixed(1)}%)`}
                            amount={lp.monthlyPayment}
                            indent
                            color="loan"
                        />
                    ))}
                </FlowSection>

                {/* 3. 고정 지출 */}
                <FlowSection emoji="🏠" title="고정 지출 합계" total={forecast.fixedExpense} color="expense">
                    <FlowRow label="고정 지출 (자동이체 기반)" amount={forecast.fixedExpense} indent color="expense" />
                </FlowSection>

                {/* 4. 변동 지출 (예산) */}
                <FlowSection emoji="🛒" title="변동 지출 (예산)" total={forecast.budgetedExpense} color="expense">
                    <FlowRow label="월 예산 총액" amount={forecast.budgetedExpense} indent color="expense" />
                </FlowSection>

                {/* 구분선 (굵은) */}
                <div className="border-t-2 border-gray-300 dark:border-zinc-700 my-3" />

                {/* 5. FRS (가용자금) */}
                <FlowSection emoji="💎" title="가용 자금 (FRS)" total={forecast.freeRouteSpace} color="frs">
                    {frsAllocation && (
                        <>
                            <FlowRow label="→ 저축/비상금 (30%)" amount={frsAllocation.savings} indent color="frs" />
                            <FlowRow label="→ 투자 (50%)" amount={frsAllocation.investment} indent color="frs" />
                            <FlowRow label="→ 추가 대출상환 (20%)" amount={frsAllocation.extraRepay} indent color="frs" />
                        </>
                    )}
                    {forecast.freeRouteSpace <= 0 && (
                        <div className="py-2 text-center text-xs text-red-500">⚠️ 가용 자금이 부족합니다</div>
                    )}
                </FlowSection>

                {/* 요약 바 */}
                <div className="mt-3 rounded-lg bg-gray-100 dark:bg-zinc-800 p-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>수입 대비 사용률</span>
                        <span>{forecast.fixedIncome > 0
                            ? `${((1 - forecast.freeRouteSpace / forecast.fixedIncome) * 100).toFixed(0)}%`
                            : '-'
                        }</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden flex">
                        {/* 대출 */}
                        {forecast.fixedIncome > 0 && (
                            <>
                                <div className="h-3 bg-orange-400" style={{ width: `${(forecast.totalLoanPayment / forecast.fixedIncome * 100)}%` }} title="대출" />
                                <div className="h-3 bg-red-400" style={{ width: `${(forecast.fixedExpense / forecast.fixedIncome * 100)}%` }} title="고정지출" />
                                <div className="h-3 bg-yellow-400" style={{ width: `${(forecast.budgetedExpense / forecast.fixedIncome * 100)}%` }} title="변동지출" />
                                <div className="h-3 bg-emerald-400" style={{ width: `${Math.max(0, forecast.freeRouteSpace / forecast.fixedIncome * 100)}%` }} title="가용" />
                            </>
                        )}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> 대출</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> 고정</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> 변동</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> 가용</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
