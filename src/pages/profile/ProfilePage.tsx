import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'react-hot-toast';

/**
 * 마이 프로필 페이지
 *
 * [Designer] 현재 계정 정보 확인 + 표시 이름 변경 + 비밀번호 변경 기능
 */
export default function ProfilePage() {
    const { user, displayName, setDisplayName } = useAuthStore();

    // 표시 이름 수정 상태
    const [newName, setNewName] = useState(displayName || '');
    const [isNameSaving, setIsNameSaving] = useState(false);

    // displayName이 나중에 로드될 경우를 대비해 동기화
    useEffect(() => {
        if (displayName) setNewName(displayName);
    }, [displayName]);

    // 비밀번호 변경 폼 상태
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);

    /** 표시 이름 수정 핸들러 */
    const handleUpdateDisplayName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newName.trim()) return;

        setIsNameSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    user_id: user.id,
                    display_name: newName.trim(),
                }, { onConflict: 'user_id' });

            if (error) throw error;

            setDisplayName(newName.trim());
            toast.success('표시 이름이 변경되었습니다.');
        } catch (err: any) {
            toast.error('변경 실패: ' + err.message);
        } finally {
            setIsNameSaving(false);
        }
    };

    /** 비밀번호 변경 핸들러 */
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.email) return;

        // 유효성 검사
        if (newPassword.length < 6) {
            toast.error('새 비밀번호는 6자 이상이어야 합니다.');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        setIsPasswordSaving(true);
        try {
            // 1. 현재 비밀번호 확인 (재로그인)
            const { error: verifyError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });
            if (verifyError) {
                toast.error('현재 비밀번호가 일치하지 않습니다.');
                return;
            }

            // 2. 새 비밀번호 설정
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (updateError) throw updateError;

            toast.success('비밀번호가 변경되었습니다.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            toast.error('변경 실패: ' + err.message);
        } finally {
            setIsPasswordSaving(false);
        }
    };

    if (!user) return <div className="p-8 text-center">로그인이 필요합니다.</div>;

    return (
        <div className="mx-auto max-w-lg space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">마이 프로필</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    계정 정보를 확인하고 비밀번호를 변경할 수 있습니다.
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

            {/* 표시 이름 변경 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">표시 이름 변경</h3>
                <form onSubmit={handleUpdateDisplayName} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">표시 이름</label>
                        <input
                            type="text"
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            placeholder="예) 덕원"
                            maxLength={20}
                        />
                        <p className="mt-1 text-xs text-gray-400">용돈 관리, 거래 입력자 표시 등에 사용됩니다.</p>
                    </div>
                    <button
                        type="submit"
                        disabled={isNameSaving || !newName.trim() || newName === displayName}
                        className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isNameSaving ? '저장 중...' : '이름 저장'}
                    </button>
                </form>
            </div>

            {/* 비밀번호 변경 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">비밀번호 변경</h3>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">현재 비밀번호</label>
                        <input
                            type="password"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            placeholder="현재 비밀번호"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">새 비밀번호</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            placeholder="새 비밀번호 (6자 이상)"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">새 비밀번호 확인</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            placeholder="새 비밀번호 다시 입력"
                        />
                        {confirmPassword && newPassword !== confirmPassword && (
                            <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isPasswordSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
                        className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isPasswordSaving ? '변경 중...' : '비밀번호 변경'}
                    </button>
                </form>
            </div>
        </div>
    );
}
