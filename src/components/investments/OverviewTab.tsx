import { useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useMonthlySnapshots, useCreateHoldingSnapshot } from '@/hooks/queries/useInvestments';
import { useInvestmentTargets } from '@/hooks/queries/useInvestmentTargets';
import { useCashFlowForecast } from '@/hooks/queries/useCashFlowForecast';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

export default function OverviewTab({ holdings }: { holdings: any[] }) {
    const { data: snapshots = [] } = useMonthlySnapshots();
    const createSnapshotMutation = useCreateHoldingSnapshot();
    const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

    // 목표 비중 및 FRS 데이터 훅 추가
    const { data: targets = [] } = useInvestmentTargets();
    const { data: cashFlowData } = useCashFlowForecast();
    const frs = cashFlowData?.freeRouteSpace || 0;

    // 요약 익스포트
    const summary = useMemo(() => {
        if (!holdings || holdings.length === 0) return { totalInvested: 0, totalValue: 0, totalProfit: 0, profitRate: 0 };
        const totalInvested = holdings.reduce((sum, h) => sum + (h.quantity * h.avg_price), 0);
        const totalValue = holdings.reduce((sum, h) => sum + (h.quantity * h.last_price), 0);
        const totalProfit = totalValue - totalInvested;
        const profitRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
        return { totalInvested, totalValue, totalProfit, profitRate };
    }, [holdings]);

    //========================================================
    // FRS 및 타겟 분석 데이터 (리밸런싱 가이드용)
    //========================================================
    const { analysisData } = useMemo(() => {
        let totalVal = 0;
        const currentThemeValues: Record<string, number> = {};

        holdings.forEach(h => {
            const val = h.quantity * h.last_price;
            const theme = h.security?.theme || '미분류';
            totalVal += val;
            currentThemeValues[theme] = (currentThemeValues[theme] || 0) + val;
        });

        const allThemes = new Set([...Object.keys(currentThemeValues), ...targets.map(t => t.theme)]);

        const result = Array.from(allThemes).map(theme => {
            const currentValue = currentThemeValues[theme] || 0;
            const currentWeight = totalVal > 0 ? (currentValue / totalVal) * 100 : 0;

            const targetObj = targets.find(t => t.theme === theme);
            const targetWeight = targetObj ? targetObj.target_weight : 0;
            const targetValue = (totalVal * targetWeight) / 100;

            const gapAmount = targetValue - currentValue;

            // 정기투자 FRS 배분
            const frsAllocation = (frs * targetWeight) / 100;

            return { theme, currentValue, currentWeight, targetWeight, gapAmount, frsAllocation };
        }).sort((a, b) => b.targetWeight - a.targetWeight);

        return { analysisData: result };
    }, [holdings, targets, frs]);

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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* 1) 리밸런싱 가이드 패널 */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm dark:border-indigo-900/30 dark:bg-indigo-900/10 lg:col-span-3">
                    <div className="mb-4">
                        <h3 className="text-base font-semibold text-indigo-900 dark:text-indigo-200">💡 이번 달 FRS 리밸런싱 가이드 (총 ₩{frs.toLocaleString()})</h3>
                        <p className="text-sm text-indigo-700 dark:text-indigo-400">보유 자산과 설정된 목표 비중을 분석하여 매수가 시급한 섹터와 가처분 소득 분배를 제안합니다.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {analysisData.filter(d => d.gapAmount > 0).slice(0, 3).map((d, i) => (
                            <div key={i} className="bg-white dark:bg-zinc-900/50 rounded-lg p-4 border border-indigo-100 dark:border-indigo-800/50">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{d.theme}</p>
                                <div className="mt-1 flex items-end justify-between">
                                    <p className="text-lg font-bold text-green-600 dark:text-green-400">₩{d.frsAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                    <p className="text-xs text-red-500">부족: ₩{d.gapAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                </div>
                            </div>
                        ))}
                        {analysisData.filter(d => d.gapAmount > 0).length === 0 && (
                            <div className="col-span-full py-2 text-sm text-green-700 dark:text-green-400">
                                목표 비중과 완벽하게 일치합니다!
                            </div>
                        )}
                    </div>
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

                {/* 배분 차트 (현재 vs 목표) */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 flex flex-col">
                    <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">자산 테마 비중 (현재 vs 목표)</h3>
                    <div className="flex-1 min-h-[300px] flex flex-col xl:flex-row items-center justify-center gap-4">
                        {/* 현재 비중 (Actual) */}
                        <div className="w-full xl:w-1/2 h-48 xl:h-full relative">
                            <p className="absolute top-0 left-0 text-xs font-semibold text-gray-500 dark:text-gray-400">현재 비중 (Actual)</p>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analysisData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={2}
                                        dataKey="currentValue"
                                        label={({ percent }) => (percent ?? 0) > 0 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''}
                                    >
                                        {analysisData.map((d, index) => (
                                            <Cell key={`actual-${index}`} fill={COLORS[index % COLORS.length]} opacity={d.currentValue > 0 ? 1 : 0.3} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: any, _name: any, props: any) => [`₩${Number(v).toLocaleString()} (${props.payload.theme})`, '현재 평가액']} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* 목표 비중 (Target) */}
                        <div className="w-full xl:w-1/2 h-48 xl:h-full relative mt-4 xl:mt-0 pt-4 xl:pt-0 border-t xl:border-t-0 xl:border-l border-gray-100 dark:border-zinc-800">
                            <p className="absolute top-0 xl:top-0 left-0 xl:left-4 text-xs font-semibold text-gray-500 dark:text-gray-400">목표 비중 (Target)</p>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analysisData.filter(d => d.targetWeight > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={2}
                                        dataKey="targetWeight"
                                        label={({ payload }) => `${(payload.targetWeight ?? 0).toFixed(0)}%`}
                                    >
                                        {analysisData.filter(d => d.targetWeight > 0).map((d, index) => {
                                            // analysisData 배열과 색상을 맞추기 위해 원본 index 찾기
                                            const originalIndex = analysisData.findIndex(orig => orig.theme === d.theme);
                                            return <Cell key={`target-${index}`} fill={COLORS[originalIndex % COLORS.length]} />;
                                        })}
                                    </Pie>
                                    <Tooltip formatter={(v: any, _name: any, props: any) => [`${Number(v).toFixed(1)}%`, props.payload.theme]} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    {/* 통합 범례 */}
                    <div className="mt-4 flex flex-wrap justify-center gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
                        {analysisData.map((d, index) => (
                            <div key={`legend-${index}`} className="flex items-center text-xs">
                                <span className="w-3 h-3 rounded-full mr-1.5" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                <span className="text-gray-600 dark:text-gray-300">{d.theme}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
