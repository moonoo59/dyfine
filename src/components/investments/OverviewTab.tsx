import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

export default function OverviewTab({ holdings }: { holdings: any[] }) {
    // 요약 익스포트
    const summary = useMemo(() => {
        if (!holdings || holdings.length === 0) return { totalInvested: 0, totalValue: 0, totalProfit: 0, profitRate: 0 };
        const totalInvested = holdings.reduce((sum, h) => sum + (h.quantity * h.avg_price), 0);
        const totalValue = holdings.reduce((sum, h) => sum + (h.quantity * h.last_price), 0);
        const totalProfit = totalValue - totalInvested;
        const profitRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
        return { totalInvested, totalValue, totalProfit, profitRate };
    }, [holdings]);

    // 자산 배분 데이터
    const allocationData = useMemo(() => {
        if (!holdings) return [];
        return holdings.map(h => ({
            name: h.security?.name || h.security?.ticker || '알 수 없음',
            value: h.quantity * h.last_price
        })).sort((a, b) => b.value - a.value);
    }, [holdings]);

    return (
        <div className="space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">총 매수 금액</p>
                    <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">₩{summary.totalInvested.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">현재 평가 금액</p>
                    <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">₩{summary.totalValue.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">총 손익</p>
                    <p className={`mt-1 sm:mt-2 text-lg sm:text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {summary.totalProfit >= 0 ? '+' : ''}₩{summary.totalProfit.toLocaleString()}
                    </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">누적 수익률</p>
                    <p className={`mt-1 sm:mt-2 text-lg sm:text-2xl font-bold ${summary.profitRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {summary.profitRate >= 0 ? '+' : ''}{summary.profitRate.toFixed(2)}%
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* 보유 종목 테이블 */}
                <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
                    <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">보유 자산 상세</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                            <thead className="bg-gray-50 dark:bg-zinc-900">
                                <tr>
                                    <th className="px-4 py-3 sm:px-6 text-left text-xs font-medium uppercase tracking-wider text-gray-500">종목</th>
                                    <th className="px-4 py-3 sm:px-6 text-right text-xs font-medium uppercase tracking-wider text-gray-500">보유량 / 평단</th>
                                    <th className="px-4 py-3 sm:px-6 text-right text-xs font-medium uppercase tracking-wider text-gray-500">현재가</th>
                                    <th className="px-4 py-3 sm:px-6 text-right text-xs font-medium uppercase tracking-wider text-gray-500">평가액 / 수익률</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                                {holdings && holdings.length > 0 ? holdings.map((h) => {
                                    const value = h.quantity * h.last_price;
                                    const cost = h.quantity * h.avg_price;
                                    const profit = value - cost;
                                    const rate = cost > 0 ? (profit / cost) * 100 : 0;
                                    return (
                                        <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{h.security?.name || '알 수 없음'}</div>
                                                <div className="text-xs text-gray-500">{h.security?.ticker || 'N/A'} ({h.security?.market || 'N/A'})</div>
                                            </td>
                                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-right">
                                                <div className="text-sm text-gray-900 dark:text-white">{h.quantity.toLocaleString()} 주</div>
                                                <div className="text-xs text-gray-500">₩{h.avg_price.toLocaleString()}</div>
                                            </td>
                                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-semibold text-gray-900 dark:text-white">₩{h.last_price.toLocaleString()}</div>
                                            </td>
                                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">₩{value.toLocaleString()}</div>
                                                <div className={`text-xs font-medium ${rate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                    {rate >= 0 ? '+' : ''}{rate.toFixed(2)}%
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                                            보유 중인 자산이 없습니다. 매수 기록을 추가해보세요.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 배분 차트 */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">자산 비중 (평가액 기준)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={allocationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ percent: p }) => `${((p ?? 0) * 100).toFixed(0)}%`}
                                >
                                    {allocationData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => `₩${Number(v).toLocaleString()}`} />
                                <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
