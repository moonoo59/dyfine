import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export interface Account {
    id: number;
    household_id: string;
    group_id: number | null;
    name: string;
    account_type: 'bank' | 'brokerage' | 'virtual' | 'external';
    currency: string;
    opening_balance: number;
    is_active: boolean;
}

export interface AccountGroup {
    id: number;
    household_id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
}

export default function AccountsPage() {
    const { user } = useAuthStore();
    const [accounts, setAccounts] = useState<Account[]>([]);
    // const [groups, setGroups] = useState<AccountGroup[]>([]); // 임시 미사용
    const [loading, setLoading] = useState(true);

    // 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState<'bank' | 'brokerage' | 'virtual' | 'external'>('bank');
    const [newOpeningBalance, setNewOpeningBalance] = useState<number>(0);

    useEffect(() => {
        fetchAccountsAndGroups();
    }, [user]);

    const fetchAccountsAndGroups = async () => {
        if (!user) return;
        setLoading(true);

        // 현재 유저의 가구 ID 확인
        const { data: memberData } = await supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', user.id)
            .single();

        if (!memberData) return;

        // 계좌 그룹 가져오기 (향후 UI 연결용)
        const { } = await supabase
            .from('account_groups')
            .select('*')
            .eq('household_id', memberData.household_id)
            .order('sort_order');

        // 계좌 가져오기
        const { data: accountsData } = await supabase
            .from('accounts')
            .select('*')
            .eq('household_id', memberData.household_id)
            .order('id');

        // setGroups(groupsData || []);
        setAccounts(accountsData || []);
        setLoading(false);
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newAccountName.trim()) return;

        const { data: memberData } = await supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', user.id)
            .single();

        if (!memberData) return;

        const { error } = await supabase
            .from('accounts')
            .insert([{
                household_id: memberData.household_id,
                name: newAccountName,
                account_type: newAccountType,
                opening_balance: newOpeningBalance,
                // group_id는 Phase 1 추가 고도화 때 연결 고려
            }]);

        if (!error) {
            setIsModalOpen(false);
            setNewAccountName('');
            setNewOpeningBalance(0);
            fetchAccountsAndGroups(); // 리스트 갱신
        } else {
            alert('계좌 생성 실패: ' + error.message);
        }
    };

    // 계좌 타입 한글 라벨링 헬퍼
    const getAccountTypeLabel = (type: string) => {
        switch (type) {
            case 'bank': return '입출금/예적금';
            case 'brokerage': return '증권/투자';
            case 'virtual': return '가상/페이';
            case 'external': return '외부/신용카드';
            default: return type;
        }
    };

    if (loading) {
        return <div className="text-zinc-500">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">계좌 관리</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">자산을 관리하고 현금 흐름을 추적할 계좌를 설정하세요.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                >
                    새 계좌 추가
                </button>
            </div>

            {/* 계좌 리스트 영역 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                <ul role="list" className="divide-y divide-gray-200 dark:divide-zinc-800">
                    {accounts.length === 0 ? (
                        <li className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            등록된 계좌가 없습니다. 새 계좌를 추가해보세요.
                        </li>
                    ) : (
                        accounts.map((account) => (
                            <li key={account.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                <div className="flex flex-col">
                                    <span className="text-base font-semibold text-gray-900 dark:text-white">{account.name}</span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">{getAccountTypeLabel(account.account_type)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-base font-medium text-gray-900 dark:text-white">
                                        {account.opening_balance.toLocaleString()} {account.currency}
                                    </span>
                                    <span className={`text-xs px-2 py-1 mt-1 rounded-full ${account.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {account.is_active ? '활성' : '비활성'}
                                    </span>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>

            {/* 계좌 추가 모달 (간단 구현) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">새 계좌 추가</h2>
                        <form onSubmit={handleCreateAccount} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">계좌명</label>
                                <input
                                    type="text"
                                    required
                                    value={newAccountName}
                                    onChange={(e) => setNewAccountName(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:text-sm"
                                    placeholder="예) 카카오뱅크 생활비"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">계좌 유형</label>
                                <select
                                    value={newAccountType}
                                    onChange={(e: any) => setNewAccountType(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:text-sm"
                                >
                                    <option value="bank">입출금/예적금</option>
                                    <option value="brokerage">증권/투자</option>
                                    <option value="virtual">가상/페이</option>
                                    <option value="external">외부/신용카드</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">초기 잔액</label>
                                <input
                                    type="number"
                                    required
                                    value={newOpeningBalance}
                                    onChange={(e) => setNewOpeningBalance(Number(e.target.value))}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:text-sm"
                                />
                            </div>

                            <div className="mt-6 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                                >
                                    저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
