import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/queries/useDashboardData';
import { ExpensePieChart } from '@/components/dashboard/ExpensePieChart';
import { WaterfallChart } from '@/components/dashboard/WaterfallChart';
import { BalanceChart } from '@/components/dashboard/BalanceChart';
import { FlowChart } from '@/components/dashboard/FlowChart';
import { RecentTransactionsList } from '@/components/dashboard/RecentTransactionsList';
import MonthPicker from '@/components/ui/MonthPicker';

/**
 * 대시보드 페이지 컴포넌트 (Sprint 2 고도화)
 *
 * [PM 관점] Wireframe 3.2 요구사항 전체 구현:
 * - 기간 선택 (이번달/지난달/커스텀)
 * - KPI 카드 5개 (총자산, 현금, 수입, 지출, 미확인 이체)
 * - 4개 차트 영역: 자금 흐름(Flow), 잔액 추이(Balance), 카테고리 파이, Waterfall
 * - 해야 할 일 위젯 (미확인 자동이체)
 * - 최근 거래 내역
 */
export default function DashboardPage() {
    // 기간 선택 상태
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

    // 선택 월의 시작일/종료일 계산
    const { startDate, endDate } = useMemo(() => {
        const start = new Date(selectedYear, selectedMonth - 1, 1);
        const end = new Date(selectedYear, selectedMonth, 0); // 해당 월 마지막 날
        return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
        };
    }, [selectedYear, selectedMonth]);

    // React Query 훅으로 대시보드 데이터 조회 (기간 파라미터)
    const { data, isLoading } = useDashboardData(startDate, endDate);

    // 월 변경 핸들러 (MonthPicker에서 호출)
    const handleMonthChange = (y: number, m: number) => {
        setSelectedYear(y);
        setSelectedMonth(m);
    };

    // 로딩 상태
    if (isLoading || !data) {
        return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;
    }

    const {
        totalAssets, cashBalance, periodIncome, periodExpense, netChange,
        expenseByCategory, incomeByCategory, recentTransactions,
        pendingTransferCount, pendingTransferAmount,
        dailyBalances, flowData, investmentValue, investmentProfitRate, pendingLoanCount
    } = data;

    return (
        <div className="space-y-6 lg:space-y-8">
            {/* 상단: 제목 + 기간 선택 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">대시보드</h1>
                <MonthPicker year={selectedYear} month={selectedMonth} onChange={handleMonthChange} />
            </div>

            {/* 1. KPI 카드 */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {/* 총 자산 */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">총 자산</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        ₩{totalAssets.toLocaleString()}
                    </p>
                </div>
                {/* 현금성 잔액 */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">현금성 잔액</p>
                    <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        ₩{cashBalance.toLocaleString()}
                    </p>
                </div>
                {/* 투자 평가 자산 */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">투자 평가 자산 (수익률)</p>
                    <div className="flex items-baseline space-x-2">
                        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            ₩{investmentValue.toLocaleString()}
                        </p>
                        <span className={`text-sm font-medium ${investmentProfitRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {investmentProfitRate > 0 ? '+' : ''}{investmentProfitRate.toFixed(2)}%
                        </span>
                    </div>
                </div>
                {/* 대출 납입 예정 */}
                <div className={`rounded-xl border p-5 shadow-sm ${pendingLoanCount > 0
                    ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-900/30 dark:bg-indigo-900/10'
                    : 'border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
                    }`}>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">대출 납입 예정</p>
                    <p className={`mt-1 text-2xl font-bold ${pendingLoanCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                        {pendingLoanCount}건
                    </p>
                </div>
                {/* 수입 */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">이번 달 수입</p>
                    <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                        ₩{periodIncome.toLocaleString()}
                    </p>
                </div>
                {/* 지출 */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">이번 달 지출</p>
                    <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                        ₩{periodExpense.toLocaleString()}
                    </p>
                </div>
                {/* 미확인 자동이체 */}
                <div className="lg:col-span-2">
                    <div className={`h-full rounded-xl border p-5 shadow-sm ${pendingTransferCount > 0
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10'
                        : 'border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
                        }`}>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">미확인 이체</p>
                        <p className={`mt-1 text-2xl font-bold ${pendingTransferCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                            {pendingTransferCount}건
                        </p>
                        {pendingTransferCount > 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">₩{pendingTransferAmount.toLocaleString()}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. 차트 영역 (2x2 그리드) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 좌상: 자금 흐름 (Sankey 대체) */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">💸 자금 흐름 (이체)</h2>
                    <div className="h-64">
                        <FlowChart data={flowData} />
                    </div>
                </div>

                {/* 우상: 잔액 추이 (Balance Chart) */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">📈 잔액 추이 (Actual)</h2>
                    <div className="h-64">
                        <BalanceChart data={dailyBalances} />
                    </div>
                </div>

                {/* 좌하: 카테고리별 지출 (Pie) */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">🥧 카테고리별 지출</h2>
                    <div className="h-64 sm:h-80">
                        <ExpensePieChart data={expenseByCategory} />
                    </div>
                </div>

                {/* 우하: Waterfall (수입→지출→순증감) */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">📊 Waterfall (순증감)</h2>
                    <div className="h-64 sm:h-80">
                        <WaterfallChart income={incomeByCategory} expense={expenseByCategory} netChange={netChange} />
                    </div>
                </div>
            </div>

            {/* 3. 해야 할 일 + 최근 거래 (2열) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 해야 할 일 */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">📋 해야 할 일</h3>
                    </div>
                    <div className="p-6">
                        {pendingTransferCount > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-amber-600">⚠️</span>
                                        <span className="text-sm font-medium text-amber-800 dark:text-amber-300">미확인 자동이체</span>
                                    </div>
                                    <a href="/transfers" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium">
                                        {pendingTransferCount}건 확인하기 →
                                    </a>
                                </div>
                            </div>
                        )}

                        {pendingLoanCount > 0 && (
                            <div className="space-y-3 mt-3">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-indigo-600">📝</span>
                                        <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">대출 납입 예정</span>
                                    </div>
                                    <a href="/loans" className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium">
                                        {pendingLoanCount}건 확인하기 →
                                    </a>
                                </div>
                            </div>
                        )}

                        {pendingTransferCount === 0 && pendingLoanCount === 0 && (
                            <p className="text-sm text-green-600 dark:text-green-400">✅ 모든 작업이 완료되었습니다!</p>
                        )}
                    </div>
                </div>

                {/* 최근 거래 내역 */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">🕐 최근 거래 내역</h3>
                    </div>
                    <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                        <RecentTransactionsList transactions={recentTransactions} />
                    </ul>
                </div>
            </div>
        </div>
    );
}
