import { useState, useMemo } from 'react';
import { useTransactions, type TransactionFilters } from '@/hooks/queries/useTransactions';
import FilterBar, { type FilterValues, getDefaultFilterValues } from '@/components/ui/FilterBar';
import MonthPicker from '@/components/ui/MonthPicker';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

/** 색상 팔레트 (카테고리 차트용) */
const COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

/**
 * 리포트(Reports) 페이지 컴포넌트 (Sprint 5)
 *
 * [PM 관점] Wireframe 3.6 요구사항:
 * - 카테고리별 지출/수입 TOP 집계
 * - 필터(기간/계좌/카테고리/키워드) 연동
 * - 파이 차트 + 바 차트 시각화
 * - CSV Export
 */
export default function ReportsPage() {

    // 기간 선택 상태
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

    // 필터 상태
    const [filterValues, setFilterValues] = useState<FilterValues>(getDefaultFilterValues());

    // 선택 월 기간 계산
    const { startDate, endDate } = useMemo(() => {
        const s = new Date(selectedYear, selectedMonth - 1, 1);
        const e = new Date(selectedYear, selectedMonth, 0);
        return { startDate: s.toISOString().split('T')[0], endDate: e.toISOString().split('T')[0] };
    }, [selectedYear, selectedMonth]);

    // 필터 조합
    const filters: TransactionFilters = useMemo(() => ({
        startDate: filterValues.startDate || startDate,
        endDate: filterValues.endDate || endDate,
        ...(filterValues.accountId && { accountId: filterValues.accountId }),
        ...(filterValues.categoryId && { categoryId: filterValues.categoryId }),
        ...(filterValues.keyword && { keyword: filterValues.keyword }),
        ...(filterValues.entryType && { entryType: filterValues.entryType }),
    }), [filterValues, startDate, endDate]);

    // 거래 데이터 조회 (필터 적용)
    const { data: entries, isLoading } = useTransactions(filters, 500);

    // 카테고리별 집계 계산
    const { expenseByCategory, incomeByCategory, totalExpense, totalIncome } = useMemo(() => {
        const expMap: Record<string, number> = {};
        const incMap: Record<string, number> = {};
        let tExp = 0, tInc = 0;

        (entries || []).forEach(entry => {
            const catName = entry.category?.name || '미분류';
            if (entry.entry_type === 'expense') {
                const amt = entry.lines.reduce((s, l) => s + (l.amount < 0 ? Math.abs(l.amount) : 0), 0);
                expMap[catName] = (expMap[catName] || 0) + amt;
                tExp += amt;
            } else if (entry.entry_type === 'income') {
                const amt = entry.lines.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0);
                incMap[catName] = (incMap[catName] || 0) + amt;
                tInc += amt;
            }
        });

        return {
            expenseByCategory: Object.entries(expMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
            incomeByCategory: Object.entries(incMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
            totalExpense: tExp,
            totalIncome: tInc,
        };
    }, [entries]);

    // 월 변경 핸들러
    const handleMonthChange = (y: number, m: number) => {
        setSelectedYear(y);
        setSelectedMonth(m);
    };

    /** CSV Export */
    const handleExport = () => {
        if (!entries || entries.length === 0) return;
        const header = '날짜,유형,카테고리,메모,금액\n';
        const rows = entries.map(e => {
            const amt = e.lines.reduce((s, l) => s + l.amount, 0);
            return `${e.occurred_at.split('T')[0]},${e.entry_type},${e.category?.name || ''},${e.memo || ''},${amt}`;
        }).join('\n');
        const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dyfine_report_${selectedYear}_${selectedMonth}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (isLoading) return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">리포트</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">카테고리별 수입/지출 현황을 분석합니다.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <MonthPicker year={selectedYear} month={selectedMonth} onChange={handleMonthChange} />
                    <button onClick={handleExport} disabled={!entries?.length}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800">
                        📥 CSV Export
                    </button>
                </div>
            </div>

            {/* 필터 */}
            <FilterBar values={filterValues} onChange={setFilterValues} show={{ date: false, account: true, category: true, keyword: true, entryType: true }} />

            {/* KPI 요약 카드 */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">총 수입</p>
                    <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">₩{totalIncome.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">총 지출</p>
                    <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">₩{totalExpense.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">순증감</p>
                    <p className={`mt-1 text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        ₩{(totalIncome - totalExpense).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* 차트 영역 (2열) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 지출 파이 차트 */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">🥧 카테고리별 지출</h2>
                    <div className="h-72">
                        {expenseByCategory.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm text-gray-400">지출 데이터가 없습니다.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={90} label={({ name, percent: p }) => `${name} ${((p ?? 0) * 100).toFixed(0)}%`}>
                                        {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => `₩${Number(v).toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* 지출 바 차트 (TOP 10) */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">📊 지출 TOP 10</h2>
                    <div className="h-72">
                        {expenseByCategory.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm text-gray-400">지출 데이터가 없습니다.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={expenseByCategory.slice(0, 10)} layout="vertical" margin={{ left: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                                    <Tooltip formatter={(v: any) => `₩${Number(v).toLocaleString()}`} />
                                    <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* 수입 상세 테이블 */}
            {incomeByCategory.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">💰 수입 카테고리별 상세</h3>
                    </div>
                    <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {incomeByCategory.map((item, i) => (
                            <li key={i} className="p-4 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</span>
                                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">₩{item.value.toLocaleString()}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
