import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

export default function DashboardPage() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);

    // 대시보드 요약 지표 데이터
    const [totalAssets, setTotalAssets] = useState(0);
    const [monthlyIncome, setMonthlyIncome] = useState(0);
    const [monthlyExpense, setMonthlyExpense] = useState(0);

    // 차트 데이터 (임시)
    const [expenseByCategory, setExpenseByCategory] = useState<any[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

    // 차트 색상 (Tailwind 감성)
    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9'];

    useEffect(() => {
        fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        if (!user) return;
        setLoading(true);

        const { data: memberData } = await supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', user.id)
            .single();

        if (!memberData) return;

        // 1. 총 자산 (모든 활성 계좌의 현재 잔액 합산)
        // * 주의: MVP 단계에서는 ledger 뷰가 없으므로 accounts 테이블의 opening_balance만 가져오거나 
        //   transaction_lines의 총합을 더하는 로직이 필요. 현재는 간단히 accounts만 쿼리함.
        const { data: accData } = await supabase
            .from('accounts')
            .select('opening_balance')
            .eq('household_id', memberData.household_id)
            .eq('is_active', true);

        // 이 부분은 실무에선 백엔드 뷰나 복잡한 누적 쿼리를 써야 하나 MVP 시연용 스텁 로직임
        const baseAssets = accData?.reduce((sum, acc) => sum + acc.opening_balance, 0) || 0;
        setTotalAssets(baseAssets);

        // 2. 당월 수입/지출 합산
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        // 수입
        const { data: incomeData } = await supabase
            .from('transaction_entries')
            .select('lines:transaction_lines(amount)')
            .eq('household_id', memberData.household_id)
            .eq('entry_type', 'income')
            .gte('occurred_at', startOfMonth);

        let incSum = 0;
        incomeData?.forEach(entry => {
            incSum += entry.lines.reduce((s: number, l: any) => s + (l.amount > 0 ? l.amount : 0), 0);
        });
        setMonthlyIncome(incSum);

        // 지출
        const { data: expData } = await supabase
            .from('transaction_entries')
            .select('category_id, category:categories(name), lines:transaction_lines(amount)')
            .eq('household_id', memberData.household_id)
            .eq('entry_type', 'expense')
            .gte('occurred_at', startOfMonth);

        let expSum = 0;
        const catExpMap: Record<string, number> = {};

        expData?.forEach(entry => {
            const amount = entry.lines.reduce((s: number, l: any) => s + Math.abs(l.amount < 0 ? l.amount : 0), 0);
            expSum += amount;

            const catName = entry.category?.name || '미분류';
            catExpMap[catName] = (catExpMap[catName] || 0) + amount;
        });

        setMonthlyExpense(expSum);

        // 차트 데이터 포맷팅
        const pieData: { name: string; value: number }[] = Object.keys(catExpMap).map(key => ({
            name: key,
            value: catExpMap[key]
        })).sort((a, b) => b.value - a.value);

        setExpenseByCategory(pieData);

        // 3. 최근 거래 내역 5건
        const { data: recentTrx } = await supabase
            .from('transaction_entries')
            .select('id, occurred_at, entry_type, memo, category:categories(name), lines:transaction_lines(amount)')
            .eq('household_id', memberData.household_id)
            .order('occurred_at', { ascending: false })
            .limit(5);

        setRecentTransactions(recentTrx || []);
        setLoading(false);
    };

    if (loading) return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6 lg:space-y-8">
            {/* 1. 핵심 지표 (Hero Metrics) */}
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">대시보드</h1>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">총 자산 (기초잔액 기준)</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                        {totalAssets.toLocaleString()} ₩
                    </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">이번 달 수입</p>
                    <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                        +{monthlyIncome.toLocaleString()} ₩
                    </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">이번 달 지출</p>
                    <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                        -{monthlyExpense.toLocaleString()} ₩
                    </p>
                </div>
            </div>

            {/* 2. 차트 영역 (좌: 지출 파이 차트, 우: 막대 차트 등 가능) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 당월 지출 카테고리 비율 (Pie Chart) */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">카테고리별 지출 (당월)</h2>
                    <div className="h-64 sm:h-80">
                        {expenseByCategory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseByCategory}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {expenseByCategory.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={(value: any) => Number(value).toLocaleString() + '원'} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-gray-400">지출 데이터가 없습니다.</div>
                        )}
                    </div>
                </div>

                {/* 이번 달 예산 소진율 등 다른 차트가 들어갈 자리 */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">지출 흐름 (Waterfall / Bar)</h2>
                    <div className="h-64 sm:h-80">
                        {expenseByCategory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={expenseByCategory} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={80} />
                                    <RechartsTooltip formatter={(value: any) => Number(value).toLocaleString() + '원'} />
                                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-gray-400">데이터가 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. 최근 거래 (Summary List) */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">최근 거래 내역</h3>
                </div>
                <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                    {recentTransactions.length === 0 ? (
                        <li className="p-6 text-center text-sm text-gray-500">최근 거래 내역이 없습니다.</li>
                    ) : (
                        recentTransactions.map(trx => {
                            // 간략한 금액 합산 (절대값)
                            const amount = trx.lines.reduce((s: number, l: any) => s + Math.abs(l.amount), 0) / (trx.entry_type === 'transfer' ? 2 : 1);
                            const isInc = trx.entry_type === 'income';
                            const isExp = trx.entry_type === 'expense';

                            return (
                                <li key={trx.id} className="flex px-6 py-4 items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-900 dark:text-white">{trx.memo || trx.category?.name || '미분류'}</span>
                                        <span className="text-xs text-gray-500">{new Date(trx.occurred_at).toLocaleDateString()}</span>
                                    </div>
                                    <span className={`font-semibold ${isInc ? 'text-blue-600' : isExp ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {isInc ? '+' : isExp ? '-' : ''}{amount.toLocaleString()} 원
                                    </span>
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>
        </div>
    );
}
