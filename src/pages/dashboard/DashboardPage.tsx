import { useDashboardData } from '@/hooks/queries/useDashboardData';
import { ExpensePieChart } from '@/components/dashboard/ExpensePieChart';
import { ExpenseBarChart } from '@/components/dashboard/ExpenseBarChart';
import { RecentTransactionsList } from '@/components/dashboard/RecentTransactionsList';

/**
 * 대시보드 페이지 컴포넌트
 * - React Query(useDashboardData)로 데이터 로딩/캐싱 관리
 * - KPI 카드 (총자산, 당월 수입, 당월 지출)
 * - 카테고리별 지출 파이 차트 / 막대 차트
 * - 최근 거래 내역 5건
 */
export default function DashboardPage() {
    // React Query 훅으로 대시보드 데이터 조회 (캐시 2분)
    const { data, isLoading } = useDashboardData();

    // 데이터 로딩 중 표시
    if (isLoading || !data) {
        return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;
    }

    // 구조 분해 할당으로 데이터 추출
    const { totalAssets, monthlyIncome, monthlyExpense, expenseByCategory, recentTransactions } = data;

    return (
        <div className="space-y-6 lg:space-y-8">
            {/* 1. 핵심 지표 (Hero Metrics) */}
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">대시보드</h1>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* 총 자산 카드 */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">총 자산 (기초잔액 기준)</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                        ₩{totalAssets.toLocaleString()}
                    </p>
                </div>
                {/* 당월 수입 카드 */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">이번 달 수입</p>
                    <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                        ₩{monthlyIncome.toLocaleString()}
                    </p>
                </div>
                {/* 당월 지출 카드 */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">이번 달 지출</p>
                    <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                        ₩{monthlyExpense.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* 2. 차트 영역 (좌: 파이 차트, 우: 막대 차트) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 당월 카테고리별 지출 비율 (Pie Chart) */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">카테고리별 지출 (당월)</h2>
                    <div className="h-64 sm:h-80">
                        <ExpensePieChart data={expenseByCategory} />
                    </div>
                </div>

                {/* 지출 흐름 막대 차트 */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">지출 흐름 (Waterfall / Bar)</h2>
                    <div className="h-64 sm:h-80">
                        <ExpenseBarChart data={expenseByCategory} />
                    </div>
                </div>
            </div>

            {/* 3. 최근 거래 내역 (Summary List) */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">최근 거래 내역</h3>
                </div>
                <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                    <RecentTransactionsList transactions={recentTransactions} />
                </ul>
            </div>
        </div>
    );
}
