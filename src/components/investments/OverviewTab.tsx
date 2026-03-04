import { useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useMonthlySnapshots, useCreateHoldingSnapshot } from '@/hooks/queries/useInvestments';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

export default function OverviewTab({ holdings }: { holdings: any[] }) {
    const { data: snapshots = [] } = useMonthlySnapshots();
    const createSnapshotMutation = useCreateHoldingSnapshot();
    const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

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

    // 스냅샷 데이터 포맷팅
    const trendData = useMemo(() => {
        return snapshots.map(s => ({
            date: s.snapshot_date.substring(0, 7), // YYYY-MM
            totalValue: s.total_asset_value,
            invested: s.total_invested_amount
        }));
    }, [snapshots]);

    const handleCreateSnapshot = async () => {
        setIsCreatingSnapshot(true);
        try {
            await createSnapshotMutation.mutateAsync(undefined);
        } finally {
            setIsCreatingSnapshot(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">총 매수 금액</p>
                    <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">₩{summary.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">현재 평가 금액</p>
                    <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">₩{summary.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">총 손익</p>
                    <p className={`mt-1 sm:mt-2 text-lg sm:text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {summary.totalProfit >= 0 ? '+' : ''}₩{summary.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">누적 수익률</p>
                    <p className={`mt-1 sm:mt-2 text-lg sm:text-2xl font-bold ${summary.profitRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {summary.profitRate >= 0 ? '+' : ''}{summary.profitRate.toFixed(2)}%
                    </p>
                </div>
            </div>

            {/* 순자산 추이 라인 차트 & 스냅샷 버튼 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">월별 자산 추이</h3>
                    <button
                        onClick={handleCreateSnapshot}
                        disabled={isCreatingSnapshot}
                        className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 disabled:opacity-50"
                    >
                        {isCreatingSnapshot ? '저장 중...' : '오늘 자산 스냅샷 저장'}
                    </button>
                </div>
                <div className="h-64 sm:h-80 w-full">
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickMargin={10} />
                                <YAxis
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    tickFormatter={(val) => `₩${(val / 10000).toFixed(0)}만`}
                                    width={80}
                                />
                                <Tooltip
                                    formatter={(value: any, name: any) => [
                                        `₩${Number(value || 0).toLocaleString()}`,
                                        name === 'totalValue' ? '평가액' : '원금'
                                    ]}
                                    labelFormatter={(label) => `${label} 스냅샷`}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line type="monotone" dataKey="totalValue" name="총 평가액" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="invested" name="총 투자원금" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-zinc-800">
                            <p className="text-sm text-gray-500 text-center">
                                저장된 자산 스냅샷이 없습니다.<br />우측 상단의 버튼을 눌러 현재 자산을 기록하세요.
                            </p>
                        </div>
                    )}
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
                                                <div className="text-sm text-gray-900 dark:text-white">{h.quantity.toLocaleString(undefined, { maximumFractionDigits: 0 })} 주</div>
                                                <div className="text-xs text-gray-500">₩{h.avg_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                            </td>
                                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-semibold text-gray-900 dark:text-white">₩{h.last_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                            </td>
                                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">₩{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
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
