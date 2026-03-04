import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

/** 색상 팔레트 */
const COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

export default function ThemeTab({ holdings }: { holdings: any[] }) {

    // 테마별 자산 집계
    const { themeData, dividendData, themeBreakdown } = useMemo(() => {
        const tMap: Record<string, { totalValue: number, items: any[] }> = {};
        const dMap = { dividend: 0, growth: 0 };

        holdings.forEach(h => {
            const val = h.quantity * h.last_price;
            const theme = h.security.theme || '미분류';
            const isDiv = h.security.is_dividend_stock;

            // 테마 집계
            if (!tMap[theme]) tMap[theme] = { totalValue: 0, items: [] };
            tMap[theme].totalValue += val;
            tMap[theme].items.push({ ...h, value: val });

            // 배당주/성장주 집계
            if (isDiv) dMap.dividend += val;
            else dMap.growth += val;
        });

        // 차트용 배열 변환 (내림차순 정렬)
        const tData = Object.entries(tMap)
            .map(([name, data]) => ({ name, value: data.totalValue }))
            .sort((a, b) => b.value - a.value);

        const dData = [
            { name: '배당주 (안정형)', value: dMap.dividend },
            { name: '성장주 (수익형)', value: dMap.growth }
        ].filter(d => d.value > 0);

        // 아코디언/표용 데이터 구조 변환
        const breakdown = Object.entries(tMap)
            .map(([name, data]) => ({
                theme: name,
                totalValue: data.totalValue,
                items: data.items.sort((a, b) => b.value - a.value)
            }))
            .sort((a, b) => b.totalValue - a.totalValue);

        return { themeData: tData, dividendData: dData, themeBreakdown: breakdown };
    }, [holdings]);


    if (holdings.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500 dark:border-zinc-700 dark:text-gray-400">
                <p className="text-sm">보유 중인 투자 종목이 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 차트 영역 (2열) */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* 섹터/테마별 비중 파이 차트 */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">🚀 섹터/테마별 비중</h3>
                    <div className="h-64 sm:h-72">
                        {themeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={themeData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={90}
                                        label={({ name, percent: p }) => `${name} ${((p ?? 0) * 100).toFixed(0)}%`}
                                    >
                                        {themeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => `₩${Number(v).toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-xs text-gray-400">데이터 없음</div>
                        )}
                    </div>
                </div>

                {/* 배당/성장 포트폴리오 성격 파이 차트 */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">🛡️ 배당 vs 성장 (수익 특성)</h3>
                    <div className="h-64 sm:h-72">
                        {dividendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={dividendData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={90}
                                        label={({ name, percent: p }) => `${name} ${((p ?? 0) * 100).toFixed(0)}%`}
                                    >
                                        {dividendData.map((entry, i) => (
                                            <Cell key={i} fill={entry.name.includes('배당') ? '#3b82f6' : '#ef4444'} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => `₩${Number(v).toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-xs text-gray-400">데이터 없음</div>
                        )}
                    </div>
                </div>
            </div>

            {/* 테마별 상세 목록 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">📋 테마별 보유 종목 상세</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-zinc-800">
                    {themeBreakdown.map((tb, idx) => (
                        <div key={idx} className="p-4 sm:p-6">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-base font-bold text-indigo-600 dark:text-indigo-400">{tb.theme}</h4>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    총 평가액: ₩{tb.totalValue.toLocaleString()}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-zinc-800/50 dark:text-gray-400">
                                        <tr>
                                            <th className="px-4 py-2 font-medium">종목명/티커</th>
                                            <th className="px-4 py-2 font-medium text-right">보유 수량</th>
                                            <th className="px-4 py-2 font-medium text-right">평가 금액</th>
                                            <th className="px-4 py-2 font-medium text-center">배당 여부</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {tb.items.map((item, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-gray-900 dark:text-white">{item.security.name}</div>
                                                    <div className="text-xs text-gray-400">{item.security.ticker} ({item.security.market})</div>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}주
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white tabular-nums">
                                                    ₩{item.value.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {item.security.is_dividend_stock ? (
                                                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">배당주</span>
                                                    ) : (
                                                        <span className="text-gray-300 dark:text-zinc-600">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
