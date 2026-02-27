import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useCategories } from '@/hooks/queries/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import type { Category } from '../transactions/TransactionsPage';
import CurrencyInput from '@/components/ui/CurrencyInput';

export interface BudgetTemplate {
    id: number;
    template_id: number;
    category_id: number;
    monthly_amount: number;
    category?: Category;
}

export default function BudgetsPage() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();
    const [templates, setTemplates] = useState<BudgetTemplate[]>([]);
    // const [categories, setCategories] = useState<Category[]>([]); // 훅으로 교체됨
    const [loading, setLoading] = useState(true);

    // 카테고리 정보 훅
    const { data: categoriesData } = useCategories();
    const categories = (categoriesData as Category[]) || [];

    // 실적 데이터 (월별 합산치)
    const [performances, setPerformances] = useState<Record<number, number>>({});

    // E-14: 월별 예산 선택
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1~12

    // 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
    const [budgetAmount, setBudgetAmount] = useState<number>(0);

    // E-14: 월 이동 헬퍼
    const goToPrevMonth = () => {
        if (selectedMonth === 1) {
            setSelectedYear(y => y - 1);
            setSelectedMonth(12);
        } else {
            setSelectedMonth(m => m - 1);
        }
    };
    const goToNextMonth = () => {
        if (selectedMonth === 12) {
            setSelectedYear(y => y + 1);
            setSelectedMonth(1);
        } else {
            setSelectedMonth(m => m + 1);
        }
    };
    const goToCurrentMonth = () => {
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
    };

    useEffect(() => {
        fetchData();
    }, [user, householdId, selectedYear, selectedMonth]); // householdId + 월 변경 시에도 재조회

    const fetchData = async () => {
        if (!user || !householdId) return;
        setLoading(true);

        // 1. (생략) 카테고리 목록 가져오기 - 훅으로 분리됨

        // 2. 예산 템플릿 라인 가져오기 (budget_template_lines 테이블 사용)
        const { data: tplData } = await supabase
            .from('budget_template_lines')
            .select('*, category:categories(id, name, parent_id), template:budget_templates!inner(household_id)')
            .eq('template.household_id', householdId);

        setTemplates((tplData as unknown as BudgetTemplate[]) || []);

        // 3. 선택 월의 지출 실적 집계
        const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
        const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();
        const { data: entryData } = await supabase
            .from('transaction_entries')
            .select('category_id, lines:transaction_lines(amount)')
            .eq('household_id', householdId)
            .eq('entry_type', 'expense')
            .gte('occurred_at', startOfMonth)
            .lte('occurred_at', endOfMonth);

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

        let actionError = null;

        if (editingTemplateId) {
            // 수정
            const { error } = await supabase
                .from('budget_template_lines')
                .update({ monthly_amount: budgetAmount })
                .eq('id', editingTemplateId);

            actionError = error;
            if (error) alert('수정 실패: ' + error.message);
        } else {
            // 신규 — 먼저 기본 템플릿이 있는지 확인하고 없으면 생성
            let templateId: number | null = null;
            const { data: existingTemplate } = await supabase
                .from('budget_templates')
                .select('id')
                .eq('household_id', householdId)
                .eq('is_default', true)
                .maybeSingle();

            if (existingTemplate) {
                templateId = existingTemplate.id;
            } else {
                const { data: newTemplate, error: tplError } = await supabase
                    .from('budget_templates')
                    .insert([{ household_id: householdId, name: '기본 예산', is_default: true }])
                    .select('id')
                    .single();
                if (tplError) {
                    alert('예산 템플릿 생성 실패: ' + tplError.message);
                    return;
                }
                templateId = newTemplate.id;
            }

            const { error: insertError } = await supabase
                .from('budget_template_lines')
                .insert([{
                    template_id: templateId,
                    category_id: selectedCategoryId,
                    monthly_amount: budgetAmount
                }]);

            actionError = insertError;
            if (insertError) alert('생성 실패: ' + insertError.message);
        }

        if (!actionError) {
            setIsModalOpen(false);
            setEditingTemplateId(null);
            setSelectedCategoryId('');
            setBudgetAmount(0);
            fetchData(); // 갱신

            if (householdId) {
                // 향후 Budgets 캐시 도입 시 ['budgets', householdId] 무효화 추가
                queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
            }
        }
    }; // handleSaveTemplate 끝

    const openEditModal = (template: BudgetTemplate) => {
        setEditingTemplateId(template.id);
        setSelectedCategoryId(template.category_id);
        setBudgetAmount(template.monthly_amount);
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

            {/* E-14: 월 선택기 */}
            <div className="flex items-center justify-center space-x-4">
                <button
                    onClick={goToPrevMonth}
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-gray-400"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <button
                    onClick={goToCurrentMonth}
                    className="text-lg font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                    {selectedYear}년 {selectedMonth}월
                </button>
                <button
                    onClick={goToNextMonth}
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-gray-400"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
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
                        const progress = Math.min((currentSpend / tpl.monthly_amount) * 100, 100);
                        const isOverBudget = currentSpend > tpl.monthly_amount;

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
                                        <span className="text-gray-500">/ {tpl.monthly_amount.toLocaleString()} 원</span>
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
                                <CurrencyInput
                                    value={budgetAmount}
                                    onChange={setBudgetAmount}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
