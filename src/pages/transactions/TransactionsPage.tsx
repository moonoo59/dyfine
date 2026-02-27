import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useCategories } from '@/hooks/queries/useCategories';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CurrencyInput from '@/components/ui/CurrencyInput';

export interface Category {
    id: number;
    parent_id: number | null;
    name: string;
}

export interface TransactionEntry {
    id: number;
    occurred_at: string;
    entry_type: 'income' | 'expense' | 'transfer' | 'adjustment';
    category_id: number | null;
    memo: string;
    source: string;
    is_locked: boolean;
    lines: TransactionLine[];
    category?: Category;
}

export interface TransactionLine {
    id: number;
    entry_id: number;
    account_id: number;
    amount: number;
    line_memo: string;
    account?: { name: string };
}

export default function TransactionsPage() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();

    // 기초 데이터 React Query 훅 사용
    const { data: accountsData } = useAccounts();
    const { data: categoriesData } = useCategories();

    const accounts = accountsData || [];
    const categories = (categoriesData as Category[]) || [];

    // 전표 데이터 React Query 도입
    const { data: entriesData, isLoading: entriesLoading } = useQuery({
        queryKey: ['transactions', householdId],
        queryFn: async () => {
            if (!householdId) throw new Error('No household ID');
            const { data, error } = await supabase
                .from('transaction_entries')
                .select(`
                    *,
                    category:categories(id, name),
                    lines:transaction_lines(
                        id, amount, line_memo,
                        account:accounts(name)
                    )
                `)
                .eq('household_id', householdId)
                .order('occurred_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data as unknown as TransactionEntry[];
        },
        enabled: !!householdId
    });

    const entries = entriesData || [];

    // 모달(Quick Add) 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newAmount, setNewAmount] = useState<number>(0);
    const [newType, setNewType] = useState<'expense' | 'income' | 'transfer'>('expense');
    const [newMemo, setNewMemo] = useState('');
    const [fromAccountId, setFromAccountId] = useState<number | ''>('');
    const [toAccountId, setToAccountId] = useState<number | ''>('');
    const [categoryId, setCategoryId] = useState<number | ''>('');
    // E-05: L1→L2 캐스케이드 카테고리 선택 상태
    const [selectedL1, setSelectedL1] = useState<number | ''>('');

    // E-05: L1(대분류) 및 L2(소분류) 분리
    const l1Categories = useMemo(() => categories.filter(c => c.parent_id === null), [categories]);
    const l2Categories = useMemo(() => {
        if (!selectedL1) return [];
        return categories.filter(c => c.parent_id === selectedL1);
    }, [categories, selectedL1]);

    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !householdId || newAmount <= 0) {
            alert('금액은 0보다 커야 합니다.');
            return;
        }

        // 복식부기 로직 구성 (Lines 합계 = 0)
        // Expense: 출금계좌(-), 카테고리(Entry)
        // Income: 입금계좌(+), 카테고리(Entry)
        // Transfer: 출금계좌(-), 입금계좌(+)

        // 1. Lines 데이터 준비
        const linesToInsert = [];
        if (newType === 'expense' && fromAccountId) {
            linesToInsert.push({ account_id: fromAccountId, amount: -newAmount });
        } else if (newType === 'income' && toAccountId) {
            linesToInsert.push({ account_id: toAccountId, amount: newAmount });
        } else if (newType === 'transfer' && fromAccountId && toAccountId) {
            linesToInsert.push({ account_id: fromAccountId, amount: -newAmount });
            linesToInsert.push({ account_id: toAccountId, amount: newAmount });
        }

        if (linesToInsert.length === 0) {
            alert('계좌를 확인해주세요.');
            return;
        }

        // 2. RPC (트랜잭션) 호출
        const { error: rpcError } = await supabase.rpc('create_transaction', {
            p_household_id: householdId,
            p_occurred_at: newDate,
            p_entry_type: newType,
            p_category_id: categoryId || null,
            p_memo: newMemo,
            p_source: 'manual',
            p_created_by: user.id,
            p_lines: linesToInsert
        });

        if (rpcError) {
            alert('전표 생성 실패 (RPC Error): ' + rpcError.message);
            return;
        }

        setIsModalOpen(false);
        setNewAmount(0);
        setNewMemo('');

        // 캐시 무효화로 목록 리프레시
        if (householdId) {
            queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
            // 관련 계좌/예산 정보가 달라질 수 있으므로 같이 날려줌
            queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">거래 내역</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">모든 수입, 지출, 이체 내역을 확인하고 추가합니다.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                >
                    빠른 추가 (Quick Add)
                </button>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                {entriesLoading ? (
                    <div className="p-8 text-center text-gray-500">데이터를 불러오는 중...</div>
                ) : entries.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        등록된 거래 내역이 없습니다.
                    </div>
                ) : (
                    <ul role="list" className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {entries.map((entry) => (
                            <li key={entry.id} className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                <div className="flex items-center justify-between">
                                    {/* 날짜 및 식별 정보 */}
                                    <div className="flex flex-col">
                                        <div className="flex items-center space-x-2">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm 
                        ${entry.entry_type === 'income' ? 'bg-blue-100 text-blue-700' :
                                                    entry.entry_type === 'expense' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-700'}`}>
                                                {entry.entry_type.toUpperCase()}
                                            </span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                {new Date(entry.occurred_at).toLocaleDateString()}
                                            </span>
                                            {entry.is_locked && (
                                                <span className="text-xs text-rose-500">🔒 락업</span>
                                            )}
                                        </div>
                                        <span className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                                            {entry.memo || (entry.category?.name ?? '미분류')}
                                        </span>
                                    </div>

                                    {/* 금액 및 라인 정보 */}
                                    <div className="flex flex-col items-end space-y-1 text-sm">
                                        {entry.lines.map((line) => (
                                            <div key={line.id} className="flex items-center space-x-2">
                                                <span className="text-gray-500 dark:text-gray-400">{line.account?.name}</span>
                                                <span className={`font-medium ${line.amount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {line.amount > 0 ? '+' : ''}₩{Math.abs(line.amount).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Quick Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">빠른 추가</h2>
                        <form onSubmit={handleQuickAdd} className="space-y-4">
                            <div className="flex space-x-4">
                                <button type="button" onClick={() => setNewType('expense')} className={`flex-1 py-1 text-sm border-b-2 ${newType === 'expense' ? 'border-indigo-500 text-indigo-600 font-bold' : 'border-transparent text-gray-500'}`}>지출</button>
                                <button type="button" onClick={() => setNewType('income')} className={`flex-1 py-1 text-sm border-b-2 ${newType === 'income' ? 'border-indigo-500 text-indigo-600 font-bold' : 'border-transparent text-gray-500'}`}>수입</button>
                                <button type="button" onClick={() => setNewType('transfer')} className={`flex-1 py-1 text-sm border-b-2 ${newType === 'transfer' ? 'border-indigo-500 text-indigo-600 font-bold' : 'border-transparent text-gray-500'}`}>이체</button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">날짜</label>
                                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" required />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">금액</label>
                                <CurrencyInput
                                    value={newAmount}
                                    onChange={setNewAmount}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                />
                            </div>

                            {(newType === 'expense' || newType === 'transfer') && (
                                <div>
                                    <label className="block text-sm font-medium text-red-600">출금 계좌 (-)</label>
                                    <select value={fromAccountId} onChange={(e) => setFromAccountId(Number(e.target.value))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" required>
                                        <option value="">선택</option>
                                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {(newType === 'income' || newType === 'transfer') && (
                                <div>
                                    <label className="block text-sm font-medium text-blue-600">입금 계좌 (+)</label>
                                    <select value={toAccountId} onChange={(e) => setToAccountId(Number(e.target.value))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" required>
                                        <option value="">선택</option>
                                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {newType !== 'transfer' && (
                                <div className="space-y-3">
                                    {/* L1 대분류 선택 */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">대분류</label>
                                        <select
                                            value={selectedL1}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || '';
                                                setSelectedL1(val);
                                                // L1이 바뀌면 L2 초기화, L1 자체를 카테고리로 설정
                                                setCategoryId(val);
                                            }}
                                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                        >
                                            <option value="">미분류</option>
                                            {l1Categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                    </div>
                                    {/* L2 소분류 선택 (선택된 L1의 하위항목이 있을 때만 표시) */}
                                    {l2Categories.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">소분류</label>
                                            <select
                                                value={categoryId}
                                                onChange={(e) => setCategoryId(Number(e.target.value) || selectedL1 || '')}
                                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                            >
                                                <option value={selectedL1 as number}>대분류로 기록</option>
                                                {l2Categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">메모 (선택)</label>
                                <input type="text" value={newMemo} onChange={(e) => setNewMemo(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="설명 입력" />
                            </div>

                            <div className="mt-6 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-zinc-700 dark:text-gray-300">취소</button>
                                <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">저장</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
