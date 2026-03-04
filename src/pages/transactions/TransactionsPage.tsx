import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useCategories } from '@/hooks/queries/useCategories';
import { useTransactions, useDeleteTransaction, type TransactionFilters } from '@/hooks/queries/useTransactions';
import { useFavorites, useFavoriteActions } from '@/hooks/queries/useFavorites';
import { useQueryClient } from '@tanstack/react-query';
import FilterBar, { type FilterValues, getDefaultFilterValues } from '@/components/ui/FilterBar';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { toast } from 'react-hot-toast';

/** 카테고리 인터페이스 (다른 파일에서도 import) */
export interface Category {
    id: number;
    parent_id: number | null;
    name: string;
}

/** 거래 전표 인터페이스 */
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
    tags?: { tag: { id: number; name: string } }[];
}

/** 거래 라인 인터페이스 */
export interface TransactionLine {
    id: number;
    entry_id: number;
    account_id: number;
    amount: number;
    line_memo: string;
    account?: { name: string };
}

/** 탭 유형 */
type TabType = 'all' | 'inbox' | 'favorites' | 'import';

/**
 * 거래 내역 페이지 (Sprint 3 고도화)
 *
 * [PM 관점] Wireframe 3.3 완전 구현:
 * - 4개 탭: 전체 / 인박스(미분류) / 즐겨찾기 / Import
 * - FilterBar 연결: 기간/계좌/카테고리/키워드/유형/소스
 * - Quick Add 모달 + 즐겨찾기 저장/불러오기
 */
export default function TransactionsPage() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();

    // 기초 데이터 React Query 훅
    const { data: accountsData } = useAccounts();
    const { data: categoriesData } = useCategories();
    const accounts = accountsData || [];
    const categories = (categoriesData as Category[]) || [];

    // 탭 상태
    const [activeTab, setActiveTab] = useState<TabType>('all');

    // 필터 상태 (FilterBar와 동기화)
    const [filterValues, setFilterValues] = useState<FilterValues>(getDefaultFilterValues());

    // 필터 → useTransactions 훅 파라미터 변환
    const filters: TransactionFilters = useMemo(() => {
        const f: TransactionFilters = {};

        // 탭별 기본 필터
        if (activeTab === 'inbox') {
            // 인박스: 미분류(카테고리 없는) 거래만
            // categoryId = 0 (전체)를 유지하되, 훅에서 필터링
        } else if (activeTab === 'import') {
            f.source = 'import';
        }

        // FilterBar 값 적용
        if (filterValues.startDate) f.startDate = filterValues.startDate;
        if (filterValues.endDate) f.endDate = filterValues.endDate;
        if (filterValues.accountId) f.accountId = filterValues.accountId;
        if (filterValues.categoryId) f.categoryId = filterValues.categoryId;
        if (filterValues.keyword) f.keyword = filterValues.keyword;
        if (filterValues.entryType) f.entryType = filterValues.entryType;
        if (filterValues.source) f.source = filterValues.source;
        if (filterValues.tag) f.tag = filterValues.tag;

        return f;
    }, [activeTab, filterValues]);

    // 거래 내역 조회 (필터 적용)
    const { data: entriesData, isLoading } = useTransactions(filters);

    // 인박스 탭: 미분류 필터링 (category_id가 null인 건)
    const entries = useMemo(() => {
        const raw = entriesData || [];
        if (activeTab === 'inbox') return raw.filter(e => !e.category_id);
        return raw;
    }, [entriesData, activeTab]);

    const { deleteTransaction } = useDeleteTransaction();

    // 즐겨찾기 데이터
    const { data: favorites } = useFavorites();
    const { addFavorite, removeFavorite } = useFavoriteActions();

    // 모달(Quick Add) 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newAmount, setNewAmount] = useState<number>(0);
    const [newType, setNewType] = useState<'expense' | 'income' | 'transfer'>('expense');
    const [newMemo, setNewMemo] = useState('');
    const [fromAccountId, setFromAccountId] = useState<number | ''>('');
    const [toAccountId, setToAccountId] = useState<number | ''>('');
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [selectedL1, setSelectedL1] = useState<number | ''>('');
    const [newTags, setNewTags] = useState('');

    // L1/L2 카테고리 분리
    const l1Categories = useMemo(() => categories.filter(c => c.parent_id === null), [categories]);
    const l2Categories = useMemo(() => {
        if (!selectedL1) return [];
        return categories.filter(c => c.parent_id === selectedL1);
    }, [categories, selectedL1]);

    /** Quick Add 전표 생성 핸들러 */
    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !householdId || newAmount <= 0) {
            toast.error('금액은 0보다 커야 합니다.');
            return;
        }

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
            toast.error('계좌를 확인해주세요.');
            return;
        }

        const tagsArray = newTags.split(',').map(tag => tag.trim()).filter(Boolean);

        const { error: rpcError } = await supabase.rpc('create_transaction_with_tags', {
            p_household_id: householdId,
            p_occurred_at: newDate,
            p_entry_type: newType,
            p_category_id: categoryId || null,
            p_memo: newMemo,
            p_source: 'manual',
            p_created_by: user.id,
            p_lines: linesToInsert,
            p_tags: tagsArray
        });

        if (rpcError) {
            toast.error('전표 생성 실패: ' + rpcError.message);
            return;
        }

        setIsModalOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
        queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
        toast.success('전표가 생성되었습니다.');
    };

    /** 폼 초기화 */
    const resetForm = () => {
        setNewAmount(0);
        setNewMemo('');
        setFromAccountId('');
        setToAccountId('');
        setCategoryId('');
        setSelectedL1('');
        setNewTags('');
    };

    /** 즐겨찾기에서 폼 불러오기 */
    const loadFromFavorite = (fav: NonNullable<typeof favorites>[0]) => {
        setNewType(fav.entry_type);
        if (fav.from_account_id) setFromAccountId(fav.from_account_id);
        if (fav.to_account_id) setToAccountId(fav.to_account_id);
        if (fav.category_id) setCategoryId(fav.category_id);
        if (fav.amount) setNewAmount(fav.amount);
        if (fav.memo) setNewMemo(fav.memo);
        if (fav.tags) setNewTags(fav.tags.join(', '));
        setIsModalOpen(true);
    };

    /** 현재 폼을 즐겨찾기로 저장 */
    const saveAsFavorite = async () => {
        const name = prompt('즐겨찾기 이름을 입력하세요:');
        if (!name) return;
        try {
            await addFavorite({
                name,
                entry_type: newType,
                from_account_id: fromAccountId || null,
                to_account_id: toAccountId || null,
                category_id: categoryId || null,
                amount: newAmount || null,
                memo: newMemo || null,
                tags: newTags ? newTags.split(',').map(tag => tag.trim()).filter(Boolean) : null,
            });
            toast.success('즐겨찾기에 저장되었습니다.');
        } catch (err: any) {
            toast.error('저장 실패: ' + err.message);
        }
    };

    // 탭 설정
    const tabs: { key: TabType; label: string; count?: number }[] = [
        { key: 'all', label: '전체' },
        { key: 'inbox', label: '인박스(미분류)' },
        { key: 'favorites', label: '즐겨찾기' },
        { key: 'import', label: 'Import' },
    ];

    return (
        <div className="space-y-6">
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">거래 내역</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">모든 수입, 지출, 이체 내역을 확인하고 추가합니다.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                    빠른 추가
                </button>
            </div>

            {/* 탭 바 */}
            <div className="flex space-x-1 rounded-xl bg-gray-100 p-1 dark:bg-zinc-900">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.key
                            ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 필터 바 (즐겨찾기 탭이 아닌 경우) */}
            {activeTab !== 'favorites' && (
                <FilterBar
                    values={filterValues}
                    onChange={setFilterValues}
                    show={{
                        date: true,
                        account: true,
                        category: true,
                        keyword: true,
                        entryType: true,
                        source: activeTab !== 'import',
                    }}
                />
            )}

            {/* 즐겨찾기 탭 */}
            {activeTab === 'favorites' && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    {!favorites || favorites.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            저장된 즐겨찾기가 없습니다. Quick Add에서 '즐겨찾기 저장'을 눌러 추가하세요.
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {favorites.map(fav => (
                                <li key={fav.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                    <div className="flex items-center space-x-3">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${fav.entry_type === 'income' ? 'bg-blue-100 text-blue-700' :
                                            fav.entry_type === 'expense' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                            {fav.entry_type === 'income' ? '수입' : fav.entry_type === 'expense' ? '지출' : '이체'}
                                        </span>
                                        <span className="font-medium text-gray-900 dark:text-white">{fav.name}</span>
                                        {fav.amount && (
                                            <span className="text-sm text-gray-500">₩{fav.amount.toLocaleString()}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => loadFromFavorite(fav)}
                                            className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400"
                                        >
                                            사용
                                        </button>
                                        <button
                                            onClick={() => removeFavorite(fav.id)}
                                            className="rounded-md px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* 거래 목록 (즐겨찾기 탭이 아닌 경우) */}
            {activeTab !== 'favorites' && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-500">데이터를 불러오는 중...</div>
                    ) : entries.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            {activeTab === 'inbox' ? '미분류 거래가 없습니다. 🎉' : '조건에 맞는 거래가 없습니다.'}
                        </div>
                    ) : (
                        <ul role="list" className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {entries.map((entry) => (
                                <li key={entry.id} className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <div className="flex items-center space-x-2">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${entry.entry_type === 'income' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    entry.entry_type === 'expense' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        entry.entry_type === 'adjustment' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                            'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-400'
                                                    }`}>
                                                    {entry.entry_type === 'income' ? '수입' :
                                                        entry.entry_type === 'expense' ? '지출' :
                                                            entry.entry_type === 'adjustment' ? '조정' : '이체'}
                                                </span>
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(entry.occurred_at).toLocaleDateString('ko-KR')}
                                                </span>
                                                {entry.is_locked && <span className="text-xs text-rose-500">🔒</span>}
                                            </div>
                                            <span className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                                                {entry.memo || (entry.category?.name ?? '미분류')}
                                            </span>
                                            {/* 태그 칩스 */}
                                            {entry.tags && entry.tags.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {entry.tags.map((t) => (
                                                        <span key={t.tag.id} className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                            #{t.tag.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end space-y-1 text-sm">
                                            {entry.lines.map((line) => (
                                                <div key={line.id} className="flex items-center space-x-2">
                                                    <span className="text-gray-500 dark:text-gray-400">{line.account?.name}</span>
                                                    <span className={`font-medium ${line.amount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {line.amount > 0 ? '+' : ''}₩{Math.abs(line.amount).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                            {!entry.is_locked && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('이 거래를 삭제하시겠습니까?')) {
                                                            deleteTransaction(entry.id).then(({ error }) => {
                                                                if (error) toast.error('삭제 실패: ' + error.message);
                                                                else toast.success('삭제되었습니다.');
                                                            });
                                                        }
                                                    }}
                                                    className="text-xs text-red-500 hover:text-red-700 mt-2 text-right"
                                                >
                                                    삭제
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Quick Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">빠른 추가</h2>
                        <form onSubmit={handleQuickAdd} className="space-y-4">
                            {/* 유형 선택 탭 */}
                            <div className="flex space-x-4">
                                {(['expense', 'income', 'transfer'] as const).map(t => (
                                    <button key={t} type="button" onClick={() => setNewType(t)}
                                        className={`flex-1 py-1 text-sm border-b-2 ${newType === t ? 'border-indigo-500 text-indigo-600 font-bold' : 'border-transparent text-gray-500'}`}>
                                        {t === 'expense' ? '지출' : t === 'income' ? '수입' : '이체'}
                                    </button>
                                ))}
                            </div>

                            {/* 날짜 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">날짜</label>
                                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" required />
                            </div>

                            {/* 금액 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">금액</label>
                                <CurrencyInput value={newAmount} onChange={setNewAmount} required
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                            </div>

                            {/* 출금 계좌 */}
                            {(newType === 'expense' || newType === 'transfer') && (
                                <div>
                                    <label className="block text-sm font-medium text-red-600">출금 계좌 (-)</label>
                                    <select value={fromAccountId} onChange={(e) => setFromAccountId(Number(e.target.value))}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" required>
                                        <option value="">선택</option>
                                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* 입금 계좌 */}
                            {(newType === 'income' || newType === 'transfer') && (
                                <div>
                                    <label className="block text-sm font-medium text-blue-600">입금 계좌 (+)</label>
                                    <select value={toAccountId} onChange={(e) => setToAccountId(Number(e.target.value))}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" required>
                                        <option value="">선택</option>
                                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* 카테고리 (이체가 아닌 경우) */}
                            {newType !== 'transfer' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">대분류</label>
                                        <select value={selectedL1} onChange={(e) => { const v = Number(e.target.value) || ''; setSelectedL1(v); setCategoryId(v); }}
                                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                            <option value="">미분류</option>
                                            {l1Categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                    </div>
                                    {l2Categories.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">소분류</label>
                                            <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value) || selectedL1 || '')}
                                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                                <option value={selectedL1 as number}>대분류로 기록</option>
                                                {l2Categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 메모 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">메모 (선택)</label>
                                <input type="text" value={newMemo} onChange={(e) => setNewMemo(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="설명 입력" />
                            </div>

                            {/* 태그 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">태그 (선택)</label>
                                <input type="text" value={newTags} onChange={(e) => setNewTags(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="쉼표(,)로 구분하여 입력 (예: 회식, 커피)" />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">여러 태그 입력 시 쉼표로 구별하세요.</p>
                            </div>

                            {/* 버튼 영역 */}
                            <div className="mt-6 flex items-center justify-between">
                                <button type="button" onClick={saveAsFavorite}
                                    className="text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 font-medium">
                                    ⭐ 즐겨찾기 저장
                                </button>
                                <div className="flex space-x-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)}
                                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-zinc-700 dark:text-gray-300">취소</button>
                                    <button type="submit"
                                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">저장</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
