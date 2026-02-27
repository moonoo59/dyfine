import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

export default function OnboardingPage({ onComplete }: { onComplete: () => void }) {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [householdName, setHouseholdName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleCreateHousehold = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        setError(null);

        try {
            // 1. RPC 함수로 가구 생성 + owner 등록을 한 번에 처리 (RLS 우회)
            const { data: householdId, error: rpcError } = await supabase
                .rpc('create_household_with_owner', {
                    p_name: householdName
                });

            if (rpcError) throw rpcError;

            // 2. 프로필 이름 업데이트(선택적)
            await supabase.from('profiles').upsert({
                user_id: user.id,
                display_name: user.email?.split('@')[0] || 'User',
            });

            // 완료 콜백 (상위 컴포넌트에서 상태 변경)
            onComplete();

        } catch (err: any) {
            setError(err.message || '가구 생성 중 에러가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-900 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl dark:bg-zinc-800">
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

                    {error && (
                        <div className="text-sm text-red-500">
                            * {error}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading || !householdName.trim()}
                            className="group relative flex w-full justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900"
                        >
                            {loading ? '생성 중...' : '시작하기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
