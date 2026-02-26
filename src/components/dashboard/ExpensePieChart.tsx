import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#ec4899', '#f43f5e'];

interface ExpensePieChartProps {
    data: { name: string; value: number }[];
}

export function ExpensePieChart({ data }: ExpensePieChartProps) {
    if (data.length === 0) {
        return <div className="flex h-full items-center justify-center text-sm text-gray-400">지출 데이터가 없습니다.</div>;
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                >
                    {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <RechartsTooltip formatter={(value: any) => Number(value).toLocaleString() + '원'} />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}
