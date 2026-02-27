import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useTransferRules } from '@/hooks/queries/useTransferRules';
import { useTransferInstances } from '@/hooks/queries/useTransferInstances';
import { useQueryClient } from '@tanstack/react-query';

/**
 * 자동이체 페이지 컴포넌트
 * - React Query로 규칙/인스턴스 데이터 로딩/캐싱
 * - 확인(Confirm) 시 RPC(confirm_auto_transfer)로 원자성 보장
 * - 규칙 생성 기능 포함
 */
export default function TransfersPage() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();

    // React Query 훅으로 데이터 조회 (캐시 관리됨)
    const { data: accountsData } = useAccounts();
    const { data: rulesData, isLoading: rulesLoading } = useTransferRules();
    const { data: instancesData, isLoading: instancesLoading } = useTransferInstances();

    const accounts = accountsData || [];
    const rules = rulesData || [];
    const instances = instancesData || [];

    // 규칙 생성 폼 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [ruleName, setRuleName] = useState('');
    const [fromAccountId, setFromAccountId] = useState<number | ''>('');
    const [toAccountId, setToAccountId] = useState<number | ''>('');
    const [amount, setAmount] = useState<number>(0);
    const [transferDay, setTransferDay] = useState<number>(1);

    /**
     * 규칙 생성 핸들러
     * - 규칙 INSERT 후 임시로 당월 인스턴스도 생성 (원래는 Cron이 할 일)
     */
    const handleCreateRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !householdId || amount <= 0 || !fromAccountId || !toAccountId) return;

        // 규칙 INSERT
        const { data: newRule, error } = await supabase
            .from('auto_transfer_rules')
            .insert([{
                household_id: householdId,
                name: ruleName,
                from_account_id: fromAccountId,
                to_account_id: toAccountId,
                amount_expected: amount,
                day_of_month: transferDay,
                schedule_type: 'monthly'
            }])
            .select()
            .single();

        if (!error && newRule) {
            // MVP 데모용: 당월 대기 인스턴스 자동 생성 (원래는 Cron이 처리함)
            const targetDate = new Date();
            targetDate.setDate(transferDay);

            await supabase.from('auto_transfer_instances').insert([{
                household_id: householdId,
                rule_id: newRule.id,
                due_date: targetDate.toISOString().split('T')[0],
                expected_amount: amount,
                status: 'pending'
            }]);

            // 모달 닫기 및 폼 초기화
            setIsModalOpen(false);
            setRuleName('');
            setAmount(0);

            // 캐시 무효화로 즉시 리프레시
            queryClient.invalidateQueries({ queryKey: ['transferRules', householdId] });
            queryClient.invalidateQueries({ queryKey: ['transferInstances', householdId] });
        } else {
            alert('규칙 생성 실패: ' + error?.message);
        }
    };

    /**
     * 자동이체 인스턴스 확인(Confirm) 핸들러
     * - Supabase RPC(confirm_auto_transfer)로 원자성 보장
     * - 전표 + 라인 + 상태 업데이트를 하나의 트랜잭션으로 처리
     */
    const confirmInstance = async (instanceId: number) => {
        if (!user) return;

        const { error: rpcError } = await supabase.rpc('confirm_auto_transfer', {
            p_instance_id: instanceId,
            p_user_id: user.id
        });

        if (rpcError) {
            alert('확인 처리 실패: ' + rpcError.message);
        } else {
            // 관련 캐시 전체 무효화
            queryClient.invalidateQueries({ queryKey: ['transferInstances', householdId] });
            queryClient.invalidateQueries({ queryKey: ['transferRules', householdId] });
            queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
            queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
            queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] });
        }
    };

    // 로딩 상태
    if (rulesLoading || instancesLoading) {
        return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="space-y-8">
            {/* 1. 이체 확인 (Pending Instances) 영역 */}
            <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">확인 대기 중인 이체</h2>
                <div className="rounded-xl border border-rose-100 bg-rose-50/50 shadow-sm overflow-hidden dark:border-rose-900/30 dark:bg-rose-900/10">
                    {instances.length === 0 ? (
                        <p className="p-6 text-sm text-gray-500 dark:text-gray-400">현재 대기 중인 이체가 없습니다.</p>
                    ) : (
                        <ul className="divide-y divide-rose-100 dark:divide-rose-900/30">
                            {instances.map(inst => (
                                <li key={inst.id} className="p-4 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-gray-900 dark:text-white">{inst.rule?.name}</span>
                                        <span className="text-sm text-rose-600 dark:text-rose-400">
                                            예정일: {new Date(inst.due_date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {inst.expected_amount?.toLocaleString() || inst.rule?.amount_expected?.toLocaleString()} 원
                                        </span>
                                        <button
                                            onClick={() => confirmInstance(inst.id)}
                                            className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                                        >
                                            장부 기록 확정
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* 2. 자동이체 규칙 리스트 */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">이체 규칙 관리</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">매월 지정된 일자에 알림을 생성할 이체 규칙입니다.</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                    >
                        새 규칙 추가
                    </button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {rules.length === 0 ? (
                            <li className="p-6 text-center text-sm text-gray-500">등록된 규칙이 없습니다.</li>
                        ) : (
                            rules.map(rule => (
                                <li key={rule.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-gray-900 dark:text-white">{rule.name}</span>
                                        <span className="text-sm text-gray-500">
                                            매월 {rule.day_of_month}일 ({rule.from_account?.name || '알수없음'} ➔ {rule.to_account?.name || '알수없음'})
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className="font-medium">{rule.amount_expected.toLocaleString()} 원</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {rule.is_active ? '활성' : '비활성'}
                                        </span>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </div>

            {/* 규칙 추가 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">새 자동이체 규칙 추가</h2>
                        <form onSubmit={handleCreateRule} className="space-y-4">
                            {/* 규칙 이름 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">규칙 이름</label>
                                <input type="text" value={ruleName} onChange={e => setRuleName(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="예: 적금 이체" />
                            </div>

                            {/* 출금 계좌 */}
                            <div>
                                <label className="block text-sm font-medium text-red-600">출금 계좌 (-)</label>
                                <select value={fromAccountId} onChange={e => setFromAccountId(Number(e.target.value))} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                    <option value="">선택</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </div>

                            {/* 입금 계좌 */}
                            <div>
                                <label className="block text-sm font-medium text-blue-600">입금 계좌 (+)</label>
                                <select value={toAccountId} onChange={e => setToAccountId(Number(e.target.value))} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                    <option value="">선택</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </div>

                            {/* 이체 일자 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">이체 일자 (매월 N일)</label>
                                <input type="number" min="1" max="31" value={transferDay} onChange={e => setTransferDay(Number(e.target.value))} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                            </div>

                            {/* 이체 금액 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">이체 금액</label>
                                <input type="number" min="0" value={amount} onChange={e => setAmount(Number(e.target.value))} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                            </div>

                            {/* 버튼 영역 */}
                            <div className="mt-6 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-zinc-700 dark:text-gray-300">취소</button>
                                <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">저장</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
