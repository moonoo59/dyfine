import { useState, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
    useAllowanceBudgetFromTransactions,
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
 * [PM] 거래 내역 자동 연동 방식:
 * - 예산: 거래 내역에서 "덕원 용돈"/"여선 용돈" 카테고리 합계에서 자동 조회
 * - 고정지출: 구독료, 보험료 등 수동 관리
 * - 잔액: 거래 용돈 합계 – 고정지출 합계
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

    // 거래 내역에서 용돈 예산 자동 조회
    const { data: budgetData, isLoading: budgetLoading } = useAllowanceBudgetFromTransactions(memberName, selectedYearMonth);
    const budgetAmount = budgetData?.total || 0;

    // 고정지출 목록
    const { data: fixedExpenses, isLoading: expenseLoading } = useMyFixedExpenses();
    const upsertFixedExpense = useUpsertFixedExpense();
    const deleteFixedExpense = useDeleteFixedExpense();

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

    // 잔액 (용돈 - 고정지출)
    const remaining = budgetAmount - totalFixedExpense;

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

    const isLoading = budgetLoading || expenseLoading;

    return (
        <div className="space-y-6">
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {memberName}의 용돈 관리
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        거래 내역의 "{memberName} 용돈" 카테고리에서 자동 연동됩니다.
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
                        {/* 이번 달 용돈 (거래 연동) */}
                        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{selectedYearMonth} 용돈</p>
                            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                                ₩{budgetAmount.toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                {budgetData?.transactions.length || 0}건 거래에서 자동 집계
                            </p>
                        </div>

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
                                용돈 - 고정지출
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

                    {/* 거래 내역 상세 */}
                    {budgetData && budgetData.transactions.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                    연동된 용돈 거래 내역
                                </h3>
                            </div>
                            <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {budgetData.transactions.map((tx: any) => (
                                    <li key={tx.id} className="flex items-center justify-between p-4">
                                        <div>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {tx.description || tx.category?.name || '거래'}
                                            </span>
                                            <span className="ml-2 text-xs text-gray-400">
                                                {new Date(tx.occurred_at).toLocaleDateString('ko-KR')}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                            ₩{Math.abs(tx.amount || 0).toLocaleString()}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}

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
