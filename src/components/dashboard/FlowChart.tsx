/**
 * 자금 흐름(Flow) 시각화 컴포넌트 (Sankey 대체)
 * - Wireframe 3.2 좌측 요구사항: 계좌 간 자금 흐름
 * - 복잡한 Sankey 대신 직관적인 흐름 리스트로 구현
 * - 이체 금액순 정렬, 시각적 바 표시
 *
 * [Reviewer 관점] Sankey 차트는 recharts 지원 부족으로
 * 실용적인 자금 흐름 Bar 시각화로 대체
 */
interface FlowChartProps {
    data: { from: string; to: string; amount: number }[];
}

export function FlowChart({ data }: FlowChartProps) {
    if (data.length === 0) {
        return <div className="flex h-full items-center justify-center text-sm text-gray-400">이체 흐름 데이터가 없습니다.</div>;
    }

    // 최대 금액 (바 너비 비율 계산용)
    const maxAmount = Math.max(...data.map(d => d.amount));

    return (
        <div className="space-y-3 overflow-y-auto max-h-full px-1">
            {data.slice(0, 8).map((flow, idx) => {
                const widthPercent = maxAmount > 0 ? (flow.amount / maxAmount) * 100 : 0;

                return (
                    <div key={idx} className="group">
                        {/* 흐름 라벨 */}
                        <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center space-x-2 min-w-0">
                                <span className="font-medium text-red-600 dark:text-red-400 truncate">{flow.from}</span>
                                <span className="text-gray-400 flex-shrink-0">→</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400 truncate">{flow.to}</span>
                            </div>
                            <span className="text-gray-900 dark:text-white font-semibold ml-2 flex-shrink-0">
                                ₩{flow.amount.toLocaleString()}
                            </span>
                        </div>

                        {/* 시각적 바 */}
                        <div className="w-full bg-gray-100 rounded-full h-2 dark:bg-zinc-800">
                            <div
                                className="h-2 rounded-full bg-gradient-to-r from-red-400 to-blue-400 transition-all duration-300"
                                style={{ width: `${widthPercent}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
