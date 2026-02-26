import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar } from 'recharts';

interface ExpenseBarChartProps {
    data: { name: string; value: number }[];
}

export function ExpenseBarChart({ data }: ExpenseBarChartProps) {
    if (data.length === 0) {
        return <div className="flex h-full items-center justify-center text-sm text-gray-400">데이터가 없습니다.</div>;
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <RechartsTooltip formatter={(value: any) => Number(value).toLocaleString() + '원'} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
