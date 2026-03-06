import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAllowanceStats } from '@/hooks/queries/useAllowances';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

/**
 * 개인 용돈 시계열 통계 컴포넌트
 */
export default function AllowanceStatsTab() {
    const { user, displayName } = useAuthStore();
    const memberName = displayName || user?.email?.split('@')[0] || '나';

    // 조회 기간 (기본 6개월)
    const [monthsCount, setMonthsCount] = useState(6);

    const { data: statsData, isLoading } = useAllowanceStats(memberName, monthsCount);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <div className="text-zinc-500 dark:text-zinc-400">통계 데이터를 불러오는 중...</div>
            </div>
        );
    }

    if (!statsData) {
        return null;
    }

    const { stats, monthlyAverages, fixedTotal } = statsData;

    // Fixed Expense vs Remaining ratio (for donut chart)
    const currentBudget = stats.length > 0 ? stats[stats.length - 1].budget : 0;
    const remainingBudget = Math.max(0, currentBudget - fixedTotal);

    const pieData = [
        { name: '고정지출', value: fixedTotal },
        { name: '여유 잔액', value: remainingBudget }
    ];

    const PIE_COLORS = ['#ef4444', '#10b981']; // Red, Emerald

    // 차트 렌더링용 커스텀 툴팁
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                    <p className="mb-2 font-bold text-gray-900 dark:text-white">{label}월</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-500 dark:text-gray-400">{entry.name}:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                                ₩{entry.value.toLocaleString()}
                            </span>
                        </div>
                    ))}
                    <div className="mt-2 text-xs text-gray-400 border-t pt-2 border-gray-100 dark:border-zinc-700">
                        잔액: ₩{(payload.find((p: any) => p.dataKey === 'budget')?.value - payload.find((p: any) => p.dataKey === 'fixedExpense')?.value).toLocaleString()}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* 설정 바 */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    용돈 흐름 분석
                </h3>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">조회 기간:</span>
                    <select
                        value={monthsCount}
                        onChange={(e) => setMonthsCount(Number(e.target.value))}
                        className="rounded-md border border-gray-300 py-1.5 pl-3 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    >
                        <option value={3}>최근 3개월</option>
                        <option value={6}>최근 6개월</option>
                        <option value={12}>최근 1년</option>
                    </select>
                </div>
            </div>

            {/* KPI 카드 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-900/30 dark:bg-indigo-900/10">
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">조회 기간 평균 예산</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        ₩{monthlyAverages.budget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">조회 기간 평균 여유 잔액</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        ₩{monthlyAverages.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 p-5 dark:border-red-900/30 dark:bg-red-900/10">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">현재 고정 지출</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        ₩{fixedTotal.toLocaleString()}
                    </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">고정 지출 소진율(이번 달)</p>
                    <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {currentBudget > 0 ? ((fixedTotal / currentBudget) * 100).toFixed(1) : 0}%
                    </p>
                </div>
            </div>

            {/* 메인 차트 */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* 시계열 바 차트 */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:col-span-2">
                    <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">월별 용돈 예산 흐름</h4>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
                                <XAxis
                                    dataKey="yearMonth"
                                    tick={{ fill: '#71717a', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={(val) => `₩${(val / 10000).toFixed(0)}만`}
                                    tick={{ fill: '#71717a', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={60}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100, 100, 100, 0.1)' }} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                <Bar dataKey="budget" name="예산 총액" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                <Bar dataKey="fixedExpense" name="고정 지출" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 비용 분류 도넛 차트 */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">현재 예산 분배 비중</h4>
                    {currentBudget <= 0 ? (
                        <div className="flex h-64 items-center justify-center">
                            <p className="text-sm text-gray-500">이번 달 할당된 예산이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="flex h-64 flex-col items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val: any) => `₩${Number(val).toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-2 flex w-full justify-center space-x-6 text-xs">
                                <div className="flex items-center">
                                    <span className="mr-1.5 h-3 w-3 rounded-full bg-red-500"></span>
                                    <span className="text-gray-600 dark:text-gray-400">고정지출 ({(fixedTotal / currentBudget * 100).toFixed(0)}%)</span>
                                </div>
                                <div className="flex items-center">
                                    <span className="mr-1.5 h-3 w-3 rounded-full bg-emerald-500"></span>
                                    <span className="text-gray-600 dark:text-gray-400">여유 잔액 ({(remainingBudget / currentBudget * 100).toFixed(0)}%)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <h4 className="font-semibold text-gray-900 dark:text-white">분석 요약</h4>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    최근 {monthsCount}개월 동안 평균적으로 월 <strong>₩{monthlyAverages.budget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>의
                    용돈 예산이 편성되었으며, 그 중 현재 고정 지출인 <strong>₩{fixedTotal.toLocaleString()}</strong>를 제외하면
                    매월 <strong>₩{monthlyAverages.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>의 여유 잔액이 남는 것으로
                    분석됩니다. 고정 지출 소진율이 낮을수록 자유롭게 활용할 수 있는 가용 예산이 많아집니다.
                </p>
            </div>
        </div>
    );
}
