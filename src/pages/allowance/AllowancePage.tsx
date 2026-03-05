import { useState, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
    useMyAllowances,
    useUpsertAllowance,
    useMyFixedExpenses,
    useUpsertFixedExpense,
    useDeleteFixedExpense,
    type FixedExpense,
} from '@/hooks/queries/useAllowances';
import CurrencyInput from '@/components/ui/CurrencyInput';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { SkeletonListItem } from '@/components/ui/Skeleton';

/** 고정지출 카테고리 옵션 */
const EXPENSE_CATEGORIES = ['구독', '보험', '통신', '교통', '저축', '기타'] as const;

/**
 * 개인 용돈 관리 페이지
 *
 * [PM] 계정 연동: 각 사용자는 본인의 용돈만 조회/관리 가능
 * - RLS(owner_user_id = auth.uid())로 상대방 데이터는 아예 조회 불가
 * - profiles.display_name을 자동으로 member_name으로 사용
 */
export default function AllowancePage() {
    const { user, displayName } = useAuthStore();

    /** 현재 사용자의 display_name을 member_name으로 사용 */
    const memberName = displayName || user?.email?.split('@')[0] || '나';

    // 현재 년월 (기본값: 이번 달)
    const now = new Date();
    const [selectedYearMonth, setSelectedYearMonth] = useState(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    );

    // React Query 데이터 — RLS가 자동으로 본인 데이터만 반환
    const { data: allowances, isLoading: allowanceLoading } = useMyAllowances();
    const { data: fixedExpenses, isLoading: expenseLoading } = useMyFixedExpenses();
    const upsertAllowance = useUpsertAllowance();
    const upsertFixedExpense = useUpsertFixedExpense();
    const deleteFixedExpense = useDeleteFixedExpense();

    // 현재 선택 월의 용돈 예산
    const currentAllowance = useMemo(
        () => allowances?.find(a => a.year_month === selectedYearMonth),
        [allowances, selectedYearMonth]
    );

    // 활성 고정지출만 필터
    const activeExpenses = useMemo(
        () => (fixedExpenses || []).filter(e => e.is_active),
        [fixedExpenses]
    );

    // 고정지출 합계
    const totalFixedExpense = useMemo(
        () => activeExpenses.reduce((sum, e) => sum + e.amount, 0),
        [activeExpenses]
    );

    // 잔액 (용돈 예산 - 고정지출 합계)
    const remaining = (currentAllowance?.budget_amount || 0) - totalFixedExpense;

    // ─── 용돈 예산 설정 모달 ───
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [budgetAmount, setBudgetAmount] = useState<number>(0);
    const [budgetMemo, setBudgetMemo] = useState('');

    const openBudgetModal = () => {
        setBudgetAmount(currentAllowance?.budget_amount || 0);
        setBudgetMemo(currentAllowance?.memo || '');
        setIsBudgetModalOpen(true);
    };

    const handleSaveBudget = (e: React.FormEvent) => {
        e.preventDefault();
        upsertAllowance.mutate({
            member_name: memberName,
            year_month: selectedYearMonth,
            budget_amount: budgetAmount,
            memo: budgetMemo,
        }, {
            onSuccess: () => setIsBudgetModalOpen(false),
        });
    };

    // ─── 고정지출 추가/수정 모달 ───
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
    const [expenseLabel, setExpenseLabel] = useState('');
    const [expenseAmount, setExpenseAmount] = useState<number>(0);
    const [expenseCategory, setExpenseCategory] = useState('기타');

    const openExpenseModal = (expense?: FixedExpense) => {
        if (expense) {
            setEditingExpense(expense);
            setExpenseLabel(expense.label);
            setExpenseAmount(expense.amount);
            setExpenseCategory(expense.category);
        } else {
            setEditingExpense(null);
            setExpenseLabel('');
            setExpenseAmount(0);
            setExpenseCategory('기타');
        }
        setIsExpenseModalOpen(true);
    };

    const handleSaveExpense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!expenseLabel.trim()) return;

        upsertFixedExpense.mutate({
            id: editingExpense?.id,
            member_name: memberName,
            label: expenseLabel,
            amount: expenseAmount,
            category: expenseCategory,
        }, {
            onSuccess: () => {
                setIsExpenseModalOpen(false);
                setEditingExpense(null);
            },
        });
    };

    // ─── 고정지출 삭제 확인 ───
    const [deletingExpense, setDeletingExpense] = useState<FixedExpense | null>(null);

    const handleDeleteConfirm = () => {
        if (!deletingExpense) return;
        deleteFixedExpense.mutate(
            { id: deletingExpense.id },
            { onSuccess: () => setDeletingExpense(null) }
        );
    };

    // 카테고리별 뱃지 색상
    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case '구독': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case '보험': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case '통신': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
            case '교통': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case '저축': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-400';
        }
    };

    if (!user) return <div className="p-8 text-center">로그인이 필요합니다.</div>;

    const isLoading = allowanceLoading || expenseLoading;

    return (
        <div className="space-y-6">
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {memberName}의 용돈 관리
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        월 용돈 예산과 고정지출을 관리합니다. 본인만 조회 가능합니다.
                    </p>
                </div>
                {/* 월 선택 */}
                <input
                    type="month"
                    value={selectedYearMonth}
                    onChange={(e) => setSelectedYearMonth(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-zinc-800" />)}
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 px-4">
                        {[...Array(4)].map((_, i) => <SkeletonListItem key={i} />)}
                    </div>
                </div>
            ) : (
                <>
                    {/* 용돈 요약 카드 3종 */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {/* 이번 달 용돈 */}
                        <button
                            onClick={openBudgetModal}
                            className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-indigo-700"
                        >
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{selectedYearMonth} 용돈 예산</p>
                            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                                ₩{(currentAllowance?.budget_amount || 0).toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-indigo-500 dark:text-indigo-400">클릭하여 설정 →</p>
                        </button>

                        {/* 고정지출 합계 */}
                        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">고정지출 합계</p>
                            <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
                                ₩{totalFixedExpense.toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                {activeExpenses.length}건 활성
                            </p>
                        </div>

                        {/* 잔액 */}
                        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">자유 사용 잔액</p>
                            <p className={`mt-2 text-2xl font-bold ${remaining >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                                }`}>
                                ₩{remaining.toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                예산 - 고정지출
                            </p>
                        </div>
                    </div>

                    {/* 고정지출 목록 */}
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-between dark:border-zinc-800 dark:bg-zinc-900/50">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                고정지출 항목
                            </h3>
                            <button
                                onClick={() => openExpenseModal()}
                                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                            >
                                + 항목 추가
                            </button>
                        </div>

                        {activeExpenses.length === 0 ? (
                            <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                등록된 고정지출이 없습니다. 구독료, 보험료, 통신비 등을 추가해보세요.
                            </div>
                        ) : (
                            <ul role="list" className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {activeExpenses.map(expense => (
                                    <li key={expense.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                        <div className="flex items-center space-x-3">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryColor(expense.category)}`}>
                                                {expense.category}
                                            </span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {expense.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                ₩{expense.amount.toLocaleString()}
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openExpenseModal(expense)}
                                                    className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"
                                                >
                                                    수정
                                                </button>
                                                <button
                                                    onClick={() => setDeletingExpense(expense)}
                                                    className="text-xs text-red-500 hover:text-red-700"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                                {/* 합계 행 */}
                                <li className="flex items-center justify-between bg-gray-50 p-4 dark:bg-zinc-900/50">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">합계</span>
                                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                                        ₩{totalFixedExpense.toLocaleString()}
                                    </span>
                                </li>
                            </ul>
                        )}
                    </div>

                    {/* 월별 용돈 히스토리 */}
                    {allowances && allowances.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                    월별 용돈 이력
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-zinc-900">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">월</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">예산</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">메모</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                        {allowances.map(a => (
                                            <tr key={a.id} className={`hover:bg-gray-50 dark:hover:bg-zinc-900/50 ${a.year_month === selectedYearMonth ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                                                <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{a.year_month}</td>
                                                <td className="px-6 py-3 text-right font-semibold text-gray-900 dark:text-white">
                                                    ₩{a.budget_amount.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{a.memo || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* 용돈 예산 설정 모달 */}
            <Modal
                isOpen={isBudgetModalOpen}
                onClose={() => setIsBudgetModalOpen(false)}
                title={`${selectedYearMonth} 용돈 예산 설정`}
            >
                <form onSubmit={handleSaveBudget} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">월 용돈 예산</label>
                        <CurrencyInput
                            value={budgetAmount}
                            onChange={setBudgetAmount}
                            required
                            className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">메모 (선택)</label>
                        <input
                            type="text"
                            value={budgetMemo}
                            onChange={(e) => setBudgetMemo(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            placeholder="예) 3월 인상분 반영"
                        />
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setIsBudgetModalOpen(false)}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300">취소</button>
                        <button type="submit"
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">저장</button>
                    </div>
                </form>
            </Modal>

            {/* 고정지출 추가/수정 모달 */}
            <Modal
                isOpen={isExpenseModalOpen}
                onClose={() => { setIsExpenseModalOpen(false); setEditingExpense(null); }}
                title={editingExpense ? '고정지출 수정' : '고정지출 추가'}
            >
                <form onSubmit={handleSaveExpense} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">항목명 *</label>
                        <input
                            type="text"
                            required
                            value={expenseLabel}
                            onChange={(e) => setExpenseLabel(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            placeholder="예) 유튜브 프리미엄"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">금액 *</label>
                        <CurrencyInput
                            value={expenseAmount}
                            onChange={setExpenseAmount}
                            required
                            className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">카테고리</label>
                        <select
                            value={expenseCategory}
                            onChange={(e) => setExpenseCategory(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        >
                            {EXPENSE_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setIsExpenseModalOpen(false)}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300">취소</button>
                        <button type="submit"
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">저장</button>
                    </div>
                </form>
            </Modal>

            {/* 삭제 확인 모달 */}
            <ConfirmModal
                isOpen={deletingExpense !== null}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeletingExpense(null)}
                title="고정지출 삭제"
                message={`'${deletingExpense?.label}' 항목을 삭제하시겠습니까?`}
                confirmLabel="삭제"
                confirmVariant="danger"
            />
        </div>
    );
}
