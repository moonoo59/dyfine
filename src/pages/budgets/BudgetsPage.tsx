import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import type { Category } from '../transactions/TransactionsPage';

export interface BudgetTemplate {
    id: number;
    category_id: number;
    amount: number;
    category?: Category;
}

export default function BudgetsPage() {
    const { user, householdId } = useAuthStore();
    const [templates, setTemplates] = useState<BudgetTemplate[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // 실적 데이터 (임시: 월별 합산치)
    const [performances, setPerformances] = useState<Record<number, number>>({});

    // 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
    const [budgetAmount, setBudgetAmount] = useState<number>(0);

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        if (!user || !householdId) return;
        setLoading(true);

        // 1. 카테고리 목록 가져오기
        const { data: catData } = await supabase
            .from('categories')
            .select('id, name, parent_id')
            .eq('household_id', householdId);

        setCategories((catData as Category[]) || []);

        // 2. 예산 템플릿 가져오기
        const { data: tplData } = await supabase
            .from('budget_templates')
            .select('*, category:categories(id, name, parent_id)')
            .eq('household_id', householdId);

        setTemplates((tplData as unknown as BudgetTemplate[]) || []);

        // 3. (임시) 이번 달 지출 실적 집계
        // MVP이므로 월 초~월 말 사이의 expense 전표 중 현재 템플릿의 category_id를 묶음
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { data: entryData } = await supabase
            .from('transaction_entries')
            .select('category_id, lines:transaction_lines(amount)')
            .eq('household_id', householdId)
            .eq('entry_type', 'expense')
            .gte('occurred_at', startOfMonth);

        const currentPerformances: Record<number, number> = {};
        if (entryData) {
            entryData.forEach(entry => {
                if (entry.category_id) {
                    const expenseAmount = entry.lines.reduce((sum: number, line: any) => sum + Math.abs(line.amount), 0);
                    currentPerformances[entry.category_id] = (currentPerformances[entry.category_id] || 0) + expenseAmount;
                }
            });
        }
        setPerformances(currentPerformances);

        setLoading(false);
    };

    const handleSaveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !householdId || !selectedCategoryId || budgetAmount <= 0) return;

        if (editingTemplateId) {
            // 수정
            const { error } = await supabase
                .from('budget_templates')
                .update({ amount: budgetAmount, updated_at: new Date().toISOString() })
                .eq('id', editingTemplateId);

            if (error) alert('수정 실패: ' + error.message);
        } else {
            // 신규
            // 중복 체크
            const existing = templates.find(t => t.category_id === Number(selectedCategoryId));
            if (existing) {
                alert('이미 해당 카테고리의 예산이 존재합니다. 수정을 이용해주세요.');
                return;
            }

            const { error } = await supabase
                .from('budget_templates')
                .insert([{
                    household_id: householdId,
                    category_id: selectedCategoryId,
                    amount: budgetAmount
                }]);

            if (error) alert('생성 실패: ' + error.message);
        }

        setIsModalOpen(false);
        setEditingTemplateId(null);
        setSelectedCategoryId('');
        setBudgetAmount(0);
        fetchData(); // 갱신
    };

    const openEditModal = (template: BudgetTemplate) => {
        setEditingTemplateId(template.id);
        setSelectedCategoryId(template.category_id);
        setBudgetAmount(template.amount);
        setIsModalOpen(true);
    };

    if (loading) return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">예산 관리</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">카테고리별 월간 예산을 설정하고 현재 지출 현황을 파악합니다.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingTemplateId(null);
                        setSelectedCategoryId('');
                        setBudgetAmount(0);
                        setIsModalOpen(true);
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                    새 예산 설정
                </button>
            </div>

            {templates.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-sm text-gray-500 dark:text-gray-400">설정된 예산이 없습니다. 자주 지출하는 카테고리의 예산을 지정해 통제해보세요.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map(tpl => {
                        const currentSpend = performances[tpl.category_id] || 0;
                        const progress = Math.min((currentSpend / tpl.amount) * 100, 100);
                        const isOverBudget = currentSpend > tpl.amount;

                        return (
                            <div key={tpl.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col justify-between dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{tpl.category?.name || '알수없음'}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">이번 달 예산</p>
                                    </div>
                                    <button
                                        onClick={() => openEditModal(tpl)}
                                        className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                                    >
                                        수정
                                    </button>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className={isOverBudget ? 'text-red-600 font-bold' : 'text-gray-900 dark:text-white'}>
                                            {currentSpend.toLocaleString()} 원 지출
                                        </span>
                                        <span className="text-gray-500">/ {tpl.amount.toLocaleString()} 원</span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-zinc-800">
                                        <div
                                            className={`h-2.5 rounded-full ${isOverBudget ? 'bg-red-600' : progress > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>

                                    {isOverBudget && (
                                        <p className="mt-2 text-xs text-red-600 font-semibold text-right">예산을 초과했습니다!</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            {editingTemplateId ? '예산 수정' : '새 예산 설정'}
                        </h2>
                        <form onSubmit={handleSaveTemplate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">카테고리</label>
                                <select
                                    value={selectedCategoryId}
                                    onChange={e => setSelectedCategoryId(Number(e.target.value))}
                                    required
                                    disabled={!!editingTemplateId} // 수정 시 카테고리 변경 방지
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:disabled:bg-zinc-900"
                                >
                                    <option value="">선택</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">월간 배정 예산</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={budgetAmount}
                                    onChange={e => setBudgetAmount(Number(e.target.value))}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                />
                            </div>

                            <div className="mt-6 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-zinc-700 dark:text-gray-300">취소</button>
                                <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">저장</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
