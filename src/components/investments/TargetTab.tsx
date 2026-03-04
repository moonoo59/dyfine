import { useState, useMemo } from 'react';
import { useHoldings } from '@/hooks/queries/useInvestments';
import { useInvestmentTargets, useUpdateInvestmentTargets } from '@/hooks/queries/useInvestmentTargets';
import { useCashFlowForecast } from '@/hooks/queries/useCashFlowForecast';
import { toast } from 'react-hot-toast';

export default function TargetTab() {
    const { data: holdings = [] } = useHoldings();
    const { data: targets = [], isLoading: targetsLoading } = useInvestmentTargets();
    const updateTargetsMutation = useUpdateInvestmentTargets();
    const { data: cashFlowData } = useCashFlowForecast();

    // FRS (가처분 소득)
    const frs = cashFlowData?.freeRouteSpace || 0;

    // 편집 모드 상태
    const [isEditing, setIsEditing] = useState(false);
    const [editTargets, setEditTargets] = useState<{ theme: string; target_weight: number }[]>([]);

    //========================================================
    // 데이터 계산 로직
    //========================================================
    const { totalAssetValue, analysisData } = useMemo(() => {
        // 1) 테마별 현재 평가액 집계
        let totalVal = 0;
        const currentThemeValues: Record<string, number> = {};

        holdings.forEach(h => {
            const val = h.quantity * h.last_price;
            const theme = h.security.theme || '미분류';
            totalVal += val;
            currentThemeValues[theme] = (currentThemeValues[theme] || 0) + val;
        });

        // 2) 분석 데이터 생성 (현재 보유한 테마 + 목표로 설정한 테마 모두 포함)
        const allThemes = new Set([...Object.keys(currentThemeValues), ...targets.map(t => t.theme)]);

        const result = Array.from(allThemes).map(theme => {
            const currentValue = currentThemeValues[theme] || 0;
            const currentWeight = totalVal > 0 ? (currentValue / totalVal) * 100 : 0;

            const targetObj = targets.find(t => t.theme === theme);
            const targetWeight = targetObj ? targetObj.target_weight : 0;
            const targetValue = (totalVal * targetWeight) / 100;

            // 갭 = 부족/초과 금액 (목표금액 - 현재금액) -> 양수면 매수 필요, 음수면 매도(또는 유지) 필요
            const gapAmount = targetValue - currentValue;
            const gapWeight = targetWeight - currentWeight;

            // 정기투자 FRS 배분 (가처분 소득을 타겟 비중에 맞춰 배분)
            const frsAllocation = (frs * targetWeight) / 100;

            return {
                theme,
                currentValue,
                currentWeight,
                targetWeight,
                targetValue,
                gapAmount,
                gapWeight,
                frsAllocation
            };
        }).sort((a, b) => b.targetWeight - a.targetWeight); // 타겟 비중 높은 순 정렬

        return { totalAssetValue: totalVal, analysisData: result };
    }, [holdings, targets, frs]);


    //========================================================
    // 핸들러
    //========================================================
    const handleEditStart = () => {
        setIsEditing(true);
        // DB에 있는 걸로 초기화하거나, 없으면 analysisData 바탕으로 생성
        if (targets.length > 0) {
            setEditTargets(targets.map(t => ({ theme: t.theme, target_weight: t.target_weight })));
        } else {
            setEditTargets(analysisData.map(a => ({ theme: a.theme, target_weight: a.targetWeight })));
        }
    };

    const handleTargetChange = (index: number, value: number) => {
        const newTargets = [...editTargets];
        newTargets[index].target_weight = value;
        setEditTargets(newTargets);
    };

    const handleAddThemeRow = () => {
        setEditTargets([...editTargets, { theme: '새 테마', target_weight: 0 }]);
    };

    const handleThemeNameChange = (index: number, name: string) => {
        const newTargets = [...editTargets];
        newTargets[index].theme = name;
        setEditTargets(newTargets);
    };

    const handleRemoveThemeRow = (index: number) => {
        const newTargets = [...editTargets];
        newTargets.splice(index, 1);
        setEditTargets(newTargets);
    };

    const handleSaveTargets = async () => {
        // Validation: 합계가 100%인지 확인
        const totalWeight = editTargets.reduce((sum, t) => sum + t.target_weight, 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
            toast.error(`목표 비중의 합은 100%여야 합니다. (현재: ${totalWeight}%)`);
            return;
        }

        try {
            await updateTargetsMutation.mutateAsync(editTargets);
            setIsEditing(false);
        } catch (error) {
            // Error handled by mutation
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditTargets([]);
    };

    if (targetsLoading) {
        return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="space-y-6">

            {/* 가이던스 카드 */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm dark:border-indigo-900/30 dark:bg-indigo-900/10">
                <div className="flex items-start">
                    <div className="text-xl">💡</div>
                    <div className="ml-3 flex-1 text-sm text-indigo-800 dark:text-indigo-300">
                        <p className="font-semibold mb-1">정기투자(리밸런싱) 전략 가이드</p>
                        <p>현재 보유 자산의 비율과 목표 비중(Target Weight)을 비교하여, 부족한 섹터를 위주로 매수하는 <b>현금흐름(매월 가처분 소득) 기반 리밸런싱</b>을 제안합니다.</p>
                        <p className="mt-1 font-medium">이번 달 총 투자가능 가처분 소득 (FRS) 예상액: <span className="text-lg font-bold">₩{frs.toLocaleString()}</span></p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">

                {/* 헤더 바 */}
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">⚖️ 목표 비중 분석 테이블</h3>
                    {isEditing ? (
                        <div className="flex space-x-2">
                            <button onClick={handleAddThemeRow} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300">
                                + 테마 추가
                            </button>
                            <button onClick={handleCancelEdit} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300">
                                취소
                            </button>
                            <button onClick={handleSaveTargets} disabled={updateTargetsMutation.isPending} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                                저장
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleEditStart} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300">
                            목표 비중 설정
                        </button>
                    )}
                </div>

                {/* 편집 모드 */}
                {isEditing ? (
                    <div className="p-6">
                        <div className="space-y-4 max-w-lg">
                            {editTargets.map((t, idx) => (
                                <div key={idx} className="flex items-center space-x-4">
                                    <input
                                        type="text"
                                        value={t.theme}
                                        onChange={(e) => handleThemeNameChange(idx, e.target.value)}
                                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                        placeholder="테마명 (예: 배당, S&P500 등)"
                                    />
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            min="0" max="100" step="0.1"
                                            value={t.target_weight}
                                            onChange={(e) => handleTargetChange(idx, Number(e.target.value))}
                                            className="w-24 text-right rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                        />
                                        <span className="text-gray-500 dark:text-gray-400">%</span>
                                    </div>
                                    <button onClick={() => handleRemoveThemeRow(idx)} className="text-red-500 hover:text-red-700 p-2">
                                        ✕
                                    </button>
                                </div>
                            ))}

                            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-zinc-800 flex justify-between items-center text-sm">
                                <span className="font-semibold text-gray-900 dark:text-white">합계</span>
                                <span className={`font-bold ${Math.abs(editTargets.reduce((s, t) => s + t.target_weight, 0) - 100) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                                    {editTargets.reduce((s, t) => s + t.target_weight, 0).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* 뷰 모드 테이블 */
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-zinc-800/50 dark:text-gray-400">
                                <tr>
                                    <th className="px-6 py-3 font-medium">테마 / 포트폴리오</th>
                                    <th className="px-6 py-3 font-medium text-right bg-blue-50 dark:bg-blue-900/10 border-x border-gray-100 dark:border-zinc-800/50" colSpan={2}>목표 비중 (Target)</th>
                                    <th className="px-6 py-3 font-medium text-right" colSpan={2}>현재 비중 (Actual)</th>
                                    <th className="px-6 py-3 font-medium text-right bg-amber-50 dark:bg-amber-900/10 border-x border-gray-100 dark:border-zinc-800/50">차이 (Gap)</th>
                                    <th className="px-6 py-3 font-medium text-right">투자 가이드 (FRS 분배)</th>
                                </tr>
                                <tr className="text-[10px] text-gray-400 dark:text-zinc-500 bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800">
                                    <th className="px-6 py-1"></th>
                                    <th className="px-6 py-1 text-right border-l border-gray-100 dark:border-zinc-800/50">%</th>
                                    <th className="px-6 py-1 text-right border-r border-gray-100 dark:border-zinc-800/50">금액</th>
                                    <th className="px-6 py-1 text-right">%</th>
                                    <th className="px-6 py-1 text-right">금액</th>
                                    <th className="px-6 py-1 text-right border-x border-gray-100 dark:border-zinc-800/50">추가 매수 필요액</th>
                                    <th className="px-6 py-1 text-right">이번 달 추천 매수액</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {analysisData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{row.theme}</td>

                                        {/* Target */}
                                        <td className="px-6 py-4 text-right font-medium text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/5 border-l border-gray-100 dark:border-zinc-800/50">
                                            {row.targetWeight.toFixed(1)}%
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500 dark:text-zinc-400 bg-blue-50/50 dark:bg-blue-900/5 border-r border-gray-100 dark:border-zinc-800/50">
                                            ₩{row.targetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>

                                        {/* Actual */}
                                        <td className="px-6 py-4 text-right font-medium text-gray-700 dark:text-gray-300">
                                            {row.currentWeight.toFixed(1)}%
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500 dark:text-zinc-400">
                                            ₩{row.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>

                                        {/* Gap */}
                                        <td className={`px-6 py-4 text-right font-semibold border-x border-gray-100 dark:border-zinc-800/50 bg-amber-50/50 dark:bg-amber-900/5 ${row.gapAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                            {row.gapAmount > 0 ? '+' : ''}₩{row.gapAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            <div className="text-xs font-normal opacity-70">
                                                ({row.gapWeight > 0 ? '+' : ''}{row.gapWeight.toFixed(1)}%)
                                            </div>
                                        </td>

                                        {/* FRS Guide */}
                                        <td className="px-6 py-4 text-right font-bold text-green-600 dark:text-green-400">
                                            ₩{row.frsAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                ))}

                                {/* 요약 Row */}
                                {analysisData.length > 0 && (
                                    <tr className="bg-gray-100 dark:bg-zinc-800 font-bold border-t-2 border-gray-300 dark:border-zinc-700">
                                        <td className="px-6 py-3 text-gray-900 dark:text-white">총 자산</td>
                                        <td className="px-6 py-3 text-right text-blue-700 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/20 border-l border-gray-200 dark:border-zinc-700">100.0%</td>
                                        <td className="px-6 py-3 text-right text-gray-700 dark:text-zinc-300 bg-blue-100/50 dark:bg-blue-900/20 border-r border-gray-200 dark:border-zinc-700">
                                            ₩{totalAssetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-6 py-3 text-right text-gray-900 dark:text-white">100.0%</td>
                                        <td className="px-6 py-3 text-right text-gray-700 dark:text-zinc-300">
                                            ₩{totalAssetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-6 py-3 text-right border-x border-gray-200 dark:border-zinc-700">-</td>
                                        <td className="px-6 py-3 text-right text-green-700 dark:text-green-400">
                                            ₩{frs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {analysisData.length === 0 && (
                            <div className="p-8 text-center text-gray-500 text-sm">목표 비중 또는 보유 자산을 먼저 설정해주세요.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
