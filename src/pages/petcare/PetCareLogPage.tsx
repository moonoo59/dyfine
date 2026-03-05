import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePetCareLogs, useUpsertPetCareLog, useDeletePetCareLog } from '@/hooks/queries/usePetCare';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { SkeletonListItem } from '@/components/ui/Skeleton';

export default function PetCareLogPage() {
    const { user } = useAuthStore();
    const { data: logs, isLoading } = usePetCareLogs();
    const upsertLogMutation = useUpsertPetCareLog();
    const deleteLogMutation = useDeletePetCareLog();

    const [isCheckingIn, setIsCheckingIn] = useState(false);
    // 모달을 통한 수동 입력 상태
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [manualCheckIn, setManualCheckIn] = useState('');
    const [manualCheckOut, setManualCheckOut] = useState('');
    const [manualMemo, setManualMemo] = useState('');
    // 삭제 확인 모달
    const [deletingLogId, setDeletingLogId] = useState<number | null>(null);

    // 자동 시간 계산 및 저장 (간편 체크인)
    const handleCheckIn = () => {
        setIsCheckingIn(true);
        const now = new Date().toISOString();
        upsertLogMutation.mutate(
            { check_in: now, check_out: null, memo: '자동 체크인', fee: 0 },
            { onSettled: () => setIsCheckingIn(false) }
        );
    };

    // 체크아웃: 요금 자동 계산 (시간당 3,000원 가정)
    const handleCheckOut = (logId: number, checkInTime: string) => {
        const checkOutDate = new Date();
        const checkInDate = new Date(checkInTime);
        const hours = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60);
        const calculatedFee = Math.max(0, Math.ceil(hours) * 3000); // 1시간당 3000원 대력 계산

        upsertLogMutation.mutate({
            id: logId,
            check_in: checkInTime,
            check_out: checkOutDate.toISOString(),
            fee: calculatedFee,
            memo: '자동 체크아웃',
        });
    };

    // 수동 저장 핸들러
    const handleManualSave = (e: React.FormEvent) => {
        e.preventDefault();

        let calculatedFee = 0;
        if (manualCheckIn && manualCheckOut) {
            const inTime = new Date(manualCheckIn);
            const outTime = new Date(manualCheckOut);
            if (outTime > inTime) {
                const hours = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
                calculatedFee = Math.ceil(hours) * 3000;
            }
        }

        upsertLogMutation.mutate({
            check_in: new Date(manualCheckIn).toISOString(),
            check_out: manualCheckOut ? new Date(manualCheckOut).toISOString() : null,
            fee: calculatedFee,
            memo: manualMemo,
        }, {
            onSuccess: () => {
                setIsManualModalOpen(false);
                setManualCheckIn('');
                setManualCheckOut('');
                setManualMemo('');
            }
        });
    };

    const handleDelete = (id: number) => {
        setDeletingLogId(id);
    };

    const confirmDelete = () => {
        if (deletingLogId !== null) {
            deleteLogMutation.mutate(deletingLogId);
            setDeletingLogId(null);
        }
    };

    // 가장 최근 액티브한 체크인 찾기
    const activeLog = logs?.find(log => !log.check_out);

    if (!user) return <div className="p-8 text-center">로그인이 필요합니다.</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">누리무무 훈트가르텐</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">입/퇴실 일시를 기록하고 요금을 자동 계산합니다.</p>
                </div>
                <button
                    onClick={() => setIsManualModalOpen(true)}
                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
                >
                    수동 입력
                </button>
            </div>

            {/* 현재 상태 배너 (입실 중일 때) */}
            {activeLog ? (
                <div className="rounded-xl border-l-4 border-indigo-500 bg-indigo-50 p-6 dark:bg-indigo-900/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300">현재 이용 중</h3>
                            <p className="mt-1 text-sm text-indigo-700 dark:text-indigo-400">
                                입실 시간: {new Date(activeLog.check_in).toLocaleString('ko-KR')}
                            </p>
                        </div>
                        <button
                            onClick={() => handleCheckOut(activeLog.id, activeLog.check_in)}
                            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                        >
                            퇴실 및 요금 계산
                        </button>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">현재 이용 중인 멍멍이가 없습니다</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">입실을 눌러 기록을 시작하세요. (기본 시급 3,000원)</p>
                    <button
                        onClick={handleCheckIn}
                        disabled={isCheckingIn}
                        className="rounded-lg bg-green-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-green-700 transition"
                    >
                        {isCheckingIn ? '기록 중...' : '지금 입실'}
                    </button>
                </div>
            )}

            {/* 과거 기록 테이블 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">이용 기록 목록</h3>
                </div>
                {isLoading ? (
                    <div className="p-4 space-y-1">{[...Array(4)].map((_, i) => <SkeletonListItem key={i} />)}</div>
                ) : !logs || logs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">이용 기록이 없습니다.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                            <thead className="bg-gray-50 dark:bg-zinc-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">입실 일시</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">퇴실 일시</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">이용 요금</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">비고/메모</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                                {logs.filter(log => log.check_out).map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                                            {new Date(log.check_in).toLocaleString('ko-KR')}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                                            {log.check_out ? new Date(log.check_out).toLocaleString('ko-KR') : '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                                            ₩{log.fee.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {log.memo || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleDelete(log.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 수동 입력 모달 */}
            {isManualModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">수동 기록 입력</h2>
                        <form onSubmit={handleManualSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">입실 일시</label>
                                <input type="datetime-local" value={manualCheckIn} onChange={(e) => setManualCheckIn(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">퇴실 일시</label>
                                <input type="datetime-local" value={manualCheckOut} onChange={(e) => setManualCheckOut(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                <p className="mt-1 text-xs text-gray-500">입력 시 요금이 자동으로 시간당 3,000원으로 계산됩니다.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">메모</label>
                                <input type="text" value={manualMemo} onChange={(e) => setManualMemo(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="목욕 등 특이사항" />
                            </div>
                            <div className="mt-6 flex items-center justify-end space-x-3">
                                <button type="button" onClick={() => setIsManualModalOpen(false)}
                                    className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-zinc-700 dark:text-gray-300">취소</button>
                                <button type="submit"
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">저장</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 삭제 확인 모달 */}
            <ConfirmModal
                isOpen={deletingLogId !== null}
                onConfirm={confirmDelete}
                onCancel={() => setDeletingLogId(null)}
                title="기록 삭제"
                message="정말로 이 이용 기록을 삭제하시겠습니까?"
                confirmLabel="삭제"
                confirmVariant="danger"
            />
        </div>
    );
}
