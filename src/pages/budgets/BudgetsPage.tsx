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
    const [overrideMonth, setOverrideMonth] = useState<boolean>(false); // 이번 달만 적용 옵션

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
            if (overrideMonth) {
                // 특정 월 오버라이드 (Upsert)
                const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
                const { error } = await supabase
                    .from('budget_month_overrides')
                    .upsert({
                        household_id: householdId,
                        year_month: yearMonth,
                        category_id: selectedCategoryId,
                        amount: budgetAmount
                    }, { onConflict: 'household_id,year_month,category_id' });
                actionError = error;
                if (error) { toast.error('이번 달 예산 덮어쓰기 실패: ' + error.message); return; }
            } else {
                // 기본 템플릿 수정
                const { error } = await supabase
                    .from('budget_template_lines')
                    .update({ monthly_amount: budgetAmount })
                    .eq('id', editingTemplateId);
                actionError = error;
                if (error) { toast.error('기본 예산 수정 실패: ' + error.message); return; }

                // 해당 월의 오버라이드도 삭제 (오버라이드를 해제하고 기본으로 돌아가려는 의도일 수 있으므로)
                const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
                await supabase.from('budget_month_overrides')
                    .delete()
                    .eq('household_id', householdId)
                    .eq('year_month', yearMonth)
                    .eq('category_id', selectedCategoryId);
            }
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
                    <p className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        💡 설정한 금액은 이번 달 목표로 삼는 지출 한도액을 의미하며, 실제 이체 내역과는 추적 방식이 다릅니다.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingTemplateId(null);
                        setSelectedCategoryId('');
                        setBudgetAmount(0);
                        setOverrideMonth(false);
                        setIsModalOpen(true);
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                    새 예산 설정
                </button>
            </div>

            {/* 월 선택기 (공통 컴포넌트) */}
            <MonthPicker year={selectedYear} month={selectedMonth} onChange={handleMonthChange} />

            {/* 예산 표 (Table) */}
            {templates.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-sm text-gray-500 dark:text-gray-400">설정된 예산이 없습니다. 자주 지출하는 카테고리의 예산을 지정해 통제해보세요.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
                            <thead className="bg-gray-50 dark:bg-zinc-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-gray-300">카테고리</th>
                                    <th className="px-6 py-3 text-right font-semibold text-gray-900 dark:text-gray-300">목표 한도 (예산)</th>
                                    <th className="px-6 py-3 text-right font-semibold text-gray-900 dark:text-gray-300">현재까지 지출액</th>
                                    <th className="px-6 py-3 text-right font-semibold text-gray-900 dark:text-gray-300">잔여 금액</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-gray-300 w-1/4">소진율</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-300">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {templates.map(tpl => {
                                    const currentSpend = performances[tpl.category_id] || 0;
                                    const progress = Math.min((currentSpend / tpl.monthly_amount) * 100, 100);
                                    const isOverBudget = currentSpend > tpl.monthly_amount;
                                    const remaining = tpl.monthly_amount - currentSpend;

                                    return (
                                        <tr key={tpl.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                                                {tpl.category?.name || '알수없음'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                                                {tpl.monthly_amount.toLocaleString()} 원
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                                                <span className={isOverBudget ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-white'}>
                                                    {currentSpend.toLocaleString()} 원
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-700 dark:text-gray-300">
                                                {remaining >= 0 ?
                                                    <span className="text-green-600 dark:text-green-500">{remaining.toLocaleString()} 원</span> :
                                                    <span className="text-red-600 dark:text-red-500 font-bold">{remaining.toLocaleString()} 원 초과</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-zinc-800 flex-1">
                                                        <div
                                                            className={`h-2.5 rounded-full transition-all ${isOverBudget ? 'bg-red-600' : progress > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[3rem] text-right">
                                                        {progress.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-center">
                                                <button onClick={() => openEditModal(tpl)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-xs">
                                                    수정
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
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
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">목표 한도 (예월 지출 한도)</label>
                                <CurrencyInput
                                    value={budgetAmount}
                                    onChange={setBudgetAmount}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                />
                            </div>

                            {/* 특정 월 오버라이드 옵션 (수정 시에만 활성화) */}
                            {editingTemplateId && (
                                <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800">
                                    <input
                                        type="checkbox"
                                        id="overrideMonth"
                                        checked={overrideMonth}
                                        onChange={e => setOverrideMonth(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:bg-indigo-500"
                                        title={`${selectedYear}년 ${selectedMonth}월에만 이 한도를 적용합니다`}
                                    />
                                    <label htmlFor="overrideMonth" className="text-sm font-medium text-gray-900 dark:text-gray-200">
                                        이번 달({selectedYear}년 {selectedMonth}월)만 임시로 이 금액 적용하기
                                    </label>
                                </div>
                            )}

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
