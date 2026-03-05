import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'react-hot-toast';

/**
 * 마이 프로필 페이지
 *
 * [Designer] 사용자가 직접 표시 이름(display_name)을 설정할 수 있는 페이지.
 * 비밀번호 확인 후 저장하는 보안 절차 포함.
 */
export default function ProfilePage() {
    const { user, displayName, setDisplayName } = useAuthStore();

    // 폼 상태
    const [newDisplayName, setNewDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    // 현재 display_name으로 초기화
    useEffect(() => {
        setNewDisplayName(displayName || '');
    }, [displayName]);

    /** 비밀번호 확인 핸들러 */
    const handleVerifyPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.email || !password) return;

        setIsSaving(true);
        try {
            // Supabase로 현재 비밀번호 검증 (재로그인 시도)
            const { error } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password,
            });

            if (error) {
                toast.error('비밀번호가 일치하지 않습니다.');
                setIsVerified(false);
            } else {
                setIsVerified(true);
                toast.success('본인 확인 완료');
            }
        } catch (err: any) {
            toast.error('확인 실패: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    /** 프로필 저장 핸들러 */
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newDisplayName.trim()) return;

        setIsSaving(true);
        try {
            // profiles 테이블에 upsert
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    user_id: user.id,
                    display_name: newDisplayName.trim(),
                }, { onConflict: 'user_id' });

            if (error) throw error;

            // authStore에 반영
            setDisplayName(newDisplayName.trim());
            toast.success('프로필이 저장되었습니다.');
            setPassword('');
            setIsVerified(false);
        } catch (err: any) {
            toast.error('저장 실패: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return <div className="p-8 text-center">로그인이 필요합니다.</div>;

    return (
        <div className="mx-auto max-w-lg space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">마이 프로필</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    표시 이름을 설정하면 용돈 관리 등 개인화 기능에 적용됩니다.
                </p>
            </div>

            {/* 현재 정보 카드 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">현재 계정 정보</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">이메일</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">표시 이름</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {displayName || <span className="text-gray-400 italic">미설정</span>}
                        </span>
                    </div>
                </div>
            </div>

            {/* 이름 변경 폼 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">표시 이름 변경</h3>

                {/* Step 1: 비밀번호 확인 */}
                {!isVerified ? (
                    <form onSubmit={handleVerifyPassword} className="space-y-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            프로필 변경을 위해 먼저 비밀번호를 확인해주세요.
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">비밀번호</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                placeholder="현재 비밀번호 입력"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSaving || !password}
                            className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {isSaving ? '확인 중...' : '본인 확인'}
                        </button>
                    </form>
                ) : (
                    /* Step 2: 이름 입력 */
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div className="flex items-center gap-2 rounded-md bg-green-50 p-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            <span>✅</span>
                            <span>본인 확인 완료</span>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">표시 이름</label>
                            <input
                                type="text"
                                required
                                value={newDisplayName}
                                onChange={(e) => setNewDisplayName(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                placeholder="예) 덕원"
                                maxLength={20}
                            />
                            <p className="mt-1 text-xs text-gray-400">용돈 관리, 거래 입력자 표시 등에 사용됩니다.</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setIsVerified(false); setPassword(''); }}
                                className="flex-1 rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-700 dark:border-zinc-700 dark:text-gray-300"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving || !newDisplayName.trim()}
                                className="flex-1 rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isSaving ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
