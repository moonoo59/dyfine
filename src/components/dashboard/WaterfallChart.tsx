import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';

/**
 * Waterfall 차트 컴포넌트 (수입 → 카테고리 지출 → 순증감)
 * - PRD F7 + Wireframe 3.2 하단 요구사항
 * - 수입은 파란색, 지출은 빨간색, 순증감은 초록/빨강
 */
interface WaterfallChartProps {
    income: { name: string; value: number }[];
    expense: { name: string; value: number }[];
    netChange: number;
}

export function WaterfallChart({ income, expense, netChange }: WaterfallChartProps) {
    // Waterfall 데이터 구성: 수입 → 지출 → 순증감
    const data: { name: string; value: number; type: 'income' | 'expense' | 'net' }[] = [];

    // 수입 항목들
    income.forEach(item => {
        data.push({ name: item.name, value: item.value, type: 'income' });
    });

    // 지출 항목들 (음수로 표시)
    expense.slice(0, 5).forEach(item => {
        data.push({ name: item.name, value: -item.value, type: 'expense' });
    });

    // 기타 지출 합산
    if (expense.length > 5) {
        const otherExpense = expense.slice(5).reduce((s, e) => s + e.value, 0);
        data.push({ name: '기타 지출', value: -otherExpense, type: 'expense' });
    }

    // 순증감
    data.push({ name: '순증감', value: netChange, type: 'net' });

    if (data.length <= 1) {
        return <div className="flex h-full items-center justify-center text-sm text-gray-400">거래 데이터가 없습니다.</div>;
    }

    // 색상 결정 함수
    const getColor = (type: string, value: number) => {
        if (type === 'income') return '#3b82f6';
        if (type === 'expense') return '#ef4444';
        return value >= 0 ? '#22c55e' : '#ef4444';
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip
                    formatter={(value: any) => {
                        const v = Number(value);
                        return [`${v >= 0 ? '+' : ''}₩${Math.abs(v).toLocaleString()}`, '금액'];
                    }}
                />
                <ReferenceLine y={0} stroke="#9ca3af" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColor(entry.type, entry.value)} />
                    ))}
                </Bar>
            </ComposedChart>
        </ResponsiveContainer>
    );
}
