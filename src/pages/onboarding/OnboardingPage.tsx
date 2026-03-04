import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

export default function OnboardingPage({ onComplete }: { onComplete: () => void }) {
    const { user } = useAuthStore();
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [householdName, setHouseholdName] = useState('');
    const [newHouseholdId, setNewHouseholdId] = useState<string | null>(null);

    // Initial account toggles
    const [accountsToCreate, setAccountsToCreate] = useState({
        cash: true,
        bank: true,
        card: true,
        investment: false,
    });

    const handleCreateHousehold = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);

        try {
            // 1. RPC 함수로 가구 생성 + owner 등록
            const { data: householdId, error: rpcError } = await supabase
                .rpc('create_household_with_owner', {
                    p_name: householdName
                });

            if (rpcError) throw rpcError;
            setNewHouseholdId(householdId);

            // 2. 프로필 이름 업데이트
            await supabase.from('profiles').upsert({
                user_id: user.id,
                display_name: user.email?.split('@')[0] || 'User',
            });

            // 가구 생성 성공 시 Step 2로 이동
            setStep(2);
            toast.success('가구가 생성되었습니다!');

        } catch (err: any) {
            toast.error(err.message || '가구 생성 중 에러가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAccounts = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newHouseholdId) return;

        setLoading(true);
        try {
            const accounts = [];
            if (accountsToCreate.cash) accounts.push({ household_id: newHouseholdId, name: '현금 지갑', account_type: 'bank', opening_balance: 0 });
            if (accountsToCreate.bank) accounts.push({ household_id: newHouseholdId, name: '급여 통장', account_type: 'checking', opening_balance: 0 });
            if (accountsToCreate.card) accounts.push({ household_id: newHouseholdId, name: '생활비 카드', account_type: 'credit_card', opening_balance: 0 });
            if (accountsToCreate.investment) accounts.push({ household_id: newHouseholdId, name: '증권 계좌', account_type: 'investment', opening_balance: 0 });

            if (accounts.length > 0) {
                const { error } = await supabase.from('accounts').insert(accounts);
                if (error) throw error;
                toast.success('초기 계좌 세팅이 완료되었습니다.');
            }

            onComplete();
        } catch (err: any) {
            toast.error(err.message || '계좌 생성 중 에러가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-900 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl dark:bg-zinc-800">
                {step === 1 && (
                    <>
                        <div>
                            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                                환영합니다! 🎉
                            </h2>
                            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                                Dyfine을 시작하기 위해 우리 가구(Household)의 이름을 지어주세요. <br />
                                부부 공동 자금이라면 '우리집', 개인용이라면 '내 지갑'처럼 자유롭게 설정하세요.
                            </p>
                        </div>

                        <form className="mt-8 space-y-6" onSubmit={handleCreateHousehold}>
                            <div>
                                <label className="sr-only" htmlFor="householdName">가구 이름</label>
                                <input
                                    id="householdName"
                                    name="householdName"
                                    type="text"
                                    required
                                    value={householdName}
                                    onChange={(e) => setHouseholdName(e.target.value)}
                                    className="relative block w-full appearance-none rounded-lg border border-gray-300 px-3 py-3 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white sm:text-sm"
                                    placeholder="예) 슬기로운 우리집"
                                />
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading || !householdName.trim()}
                                    className="group relative flex w-full justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900"
                                >
                                    {loading ? '생성 중...' : '다음 단계로'}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div>
                            <h2 className="mt-6 text-center text-2xl font-extrabold text-gray-900 dark:text-white">
                                초기 계좌 세팅 🏦
                            </h2>
                            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                                가계부, 대출, 투자 기능을 사용하려면 기본 계좌가 필요합니다. <br />
                                자주 쓰이는 계좌를 미리 만들어드릴까요?
                            </p>
                        </div>

                        <form className="mt-8 space-y-4" onSubmit={handleCreateAccounts}>
                            <div className="space-y-3">
                                <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900/50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={accountsToCreate.cash}
                                        onChange={(e) => setAccountsToCreate(prev => ({ ...prev, cash: e.target.checked }))}
                                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">현금 지갑</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">소액 현금 지출용</span>
                                    </div>
                                </label>
                                <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900/50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={accountsToCreate.bank}
                                        onChange={(e) => setAccountsToCreate(prev => ({ ...prev, bank: e.target.checked }))}
                                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">급여 통장</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">주 거래 은행 통장</span>
                                    </div>
                                </label>
                                <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900/50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={accountsToCreate.card}
                                        onChange={(e) => setAccountsToCreate(prev => ({ ...prev, card: e.target.checked }))}
                                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">생활비 카드</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">신용카드 등 생활비 결제용</span>
                                    </div>
                                </label>
                                <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900/50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={accountsToCreate.investment}
                                        onChange={(e) => setAccountsToCreate(prev => ({ ...prev, investment: e.target.checked }))}
                                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">증권 계좌</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">주식 등 투자 관리용</span>
                                    </div>
                                </label>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => onComplete()}
                                    disabled={loading}
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
                                >
                                    건너뛰기
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 rounded-lg border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900"
                                >
                                    {loading ? '생성 중...' : '시작하기'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
