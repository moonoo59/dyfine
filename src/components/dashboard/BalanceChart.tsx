import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

/**
 * 잔액 추이(Balance) 차트 컴포넌트
 * - Wireframe 3.2 우측 요구사항: Actual 잔액 추이
 * - 일별 잔액을 라인 차트로 표시
 */
interface BalanceChartProps {
    data: { date: string; balance: number }[];
}

export function BalanceChart({ data }: BalanceChartProps) {
    if (data.length === 0) {
        return <div className="flex h-full items-center justify-center text-sm text-gray-400">잔액 추이 데이터가 없습니다.</div>;
    }

    // 날짜 포맷 (MM/DD)
    const formatDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        return `${parts[1]}/${parts[2]}`;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                />
                <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
                    width={55}
                />
                <Tooltip
                    labelFormatter={(label) => {
                        const d = new Date(label);
                        return `${d.getMonth() + 1}월 ${d.getDate()}일`;
                    }}
                    formatter={(value: any) => [`₩${Number(value).toLocaleString()}`, '잔액']}
                />
                <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#6366f1' }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
