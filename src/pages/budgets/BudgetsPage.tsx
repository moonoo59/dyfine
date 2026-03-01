import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useCategories } from '@/hooks/queries/useCategories';
import { useBudgets } from '@/hooks/queries/useBudgets';
import { useQueryClient } from '@tanstack/react-query';
import type { Category } from '../transactions/TransactionsPage';
import CurrencyInput from '@/components/ui/CurrencyInput';
import MonthPicker from '@/components/ui/MonthPicker';
import { toast } from 'react-hot-toast';

/**
 * 예산 관리 페이지 컴포넌트
 * - React Query(useBudgets)로 예산 데이터 로딩/캐싱 (월별 캐시 분리)
 * - 카테고리별 예산 설정 및 실적 비교
 * - 프로그레스 바로 소진율 시각화
 */
export default function BudgetsPage() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();

    // 카테고리 정보 훅 (전역 캐시)
    const { data: categoriesData } = useCategories();
    const categories = (categoriesData as Category[]) || [];

    // 월 선택 상태
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1~12

    // React Query 훅으로 예산 + 실적 데이터 조회 (월별 캐시 분리)
    const { data: budgetData, isLoading } = useBudgets(selectedYear, selectedMonth);
    const templates = budgetData?.templates || [];
    const performances = budgetData?.performances || {};

    // 모달 상태 (추가/수정)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
    const [budgetAmount, setBudgetAmount] = useState<number>(0);

    // 월 변경 핸들러 (MonthPicker에서 호출)
    const handleMonthChange = (y: number, m: number) => {
        setSelectedYear(y);
        setSelectedMonth(m);
    };

    /**
     * 예산 저장 핸들러 (추가/수정 공통)
     * - 수정 시: monthly_amount만 업데이트
     * - 추가 시: 기본 템플릿 존재 확인 → 없으면 생성 → 라인 추가
     */
    const handleSaveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !householdId || !selectedCategoryId || budgetAmount <= 0) return;

        let actionError = null;

        if (editingTemplateId) {
            // 수정 모드
            const { error } = await supabase
                .from('budget_template_lines')
                .update({ monthly_amount: budgetAmount })
                .eq('id', editingTemplateId);
            actionError = error;
            if (error) { toast.error('수정 실패: ' + error.message); return; }
        } else {
            // 추가 모드: 기본 템플릿 확인 및 생성
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
                    toast.error('예산 템플릿 생성 실패: ' + tplError.message);
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
            if (insertError) { toast.error('생성 실패: ' + insertError.message); return; }
        }

        if (!actionError) {
            // 모달 닫기 및 폼 초기화
            setIsModalOpen(false);
            setEditingTemplateId(null);
            setSelectedCategoryId('');
            setBudgetAmount(0);

            // 캐시 무효화로 즉시 리프레시
            toast.success('예산 설정 성공!');
            queryClient.invalidateQueries({ queryKey: ['budgets', householdId] });
        }
    };

    /** 수정 모달 열기 */
    const openEditModal = (tpl: typeof templates[0]) => {
        setEditingTemplateId(tpl.id);
        setSelectedCategoryId(tpl.category_id);
        setBudgetAmount(tpl.monthly_amount);
        setIsModalOpen(true);
    };

    // 로딩 중 표시
    if (isLoading) return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            {/* 상단 헤더 + 버튼 */}
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

            {/* 월 선택기 (공통 컴포넌트) */}
            <MonthPicker year={selectedYear} month={selectedMonth} onChange={handleMonthChange} />

            {/* 예산 카드 그리드 */}
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
                                    <button onClick={() => openEditModal(tpl)} className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
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

                                    {/* 프로그레스 바 */}
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

            {/* 예산 추가/수정 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            {editingTemplateId ? '예산 수정' : '새 예산 설정'}
                        </h2>
                        <form onSubmit={handleSaveTemplate} className="space-y-4">
                            {/* 카테고리 선택 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">카테고리</label>
                                <select
                                    value={selectedCategoryId}
                                    onChange={e => setSelectedCategoryId(Number(e.target.value))}
                                    required
                                    disabled={!!editingTemplateId}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:disabled:bg-zinc-900"
                                >
                                    <option value="">선택</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            </div>

                            {/* 예산 금액 입력 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">월간 배정 예산</label>
                                <CurrencyInput
                                    value={budgetAmount}
                                    onChange={setBudgetAmount}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                />
                            </div>

                            {/* 버튼 영역 */}
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
