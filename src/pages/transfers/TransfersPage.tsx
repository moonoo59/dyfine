import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useQueryClient } from '@tanstack/react-query';

export interface AutoTransferRule {
    id: number;
    household_id: string;
    name: string;
    from_account_id: number;
    to_account_id: number;
    amount_expected: number;
    day_of_month: number;
    is_active: boolean;
    from_account?: { name: string };
    to_account?: { name: string };
}

export interface AutoTransferInstance {
    id: number;
    rule_id: number;
    target_date?: string; // fallback in case
    due_date: string;
    status: 'pending' | 'completed' | 'skipped';
    actual_entry_id: number | null;
    rule?: AutoTransferRule;
}

export default function TransfersPage() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();
    const [rules, setRules] = useState<AutoTransferRule[]>([]);
    const [instances, setInstances] = useState<AutoTransferInstance[]>([]);
    // const [accounts, setAccounts] = useState<any[]>([]); // 훅으로 교체됨
    const [loading, setLoading] = useState(true);

    // 계좌 정보 훅
    const { data: accountsData } = useAccounts();
    const accounts = accountsData || [];

    // 규칙 생성 폼 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [ruleName, setRuleName] = useState('');
    const [fromAccountId, setFromAccountId] = useState<number | ''>('');
    const [toAccountId, setToAccountId] = useState<number | ''>('');
    const [amount, setAmount] = useState<number>(0);
    const [transferDay, setTransferDay] = useState<number>(1);

    useEffect(() => {
        fetchData();
    }, [user, householdId]);

    const fetchData = async () => {
        if (!user || !householdId) return;
        setLoading(true);

        // 1. 규칙 목록 가져오기
        const { data: rulesData } = await supabase
            .from('auto_transfer_rules')
            .select('*, from_account:accounts!from_account_id(name), to_account:accounts!to_account_id(name)')
            .eq('household_id', householdId)
            .order('transfer_day');

        setRules(rulesData || []);

        // 2. 예정된 이체 인스턴스 (최근/예정 1개월 치 정도만 일단 표시 - MVP)
        // 실제로는 Cloudflare Worker CRON이 매일 이걸 생성해줘야 함
        // 구현 테스트를 위해 pending 상태만 끌어옴
        if (rulesData && rulesData.length > 0) {
            const ruleIds = rulesData.map(r => r.id);
            const { data: instanceData } = await supabase
                .from('auto_transfer_instances')
                .select('*, rule:auto_transfer_rules(name, amount_expected, day_of_month)')
                .in('rule_id', ruleIds)
                .eq('status', 'pending')
                .order('target_date', { ascending: true });

            setInstances(instanceData || []);
        }

        setLoading(false);
    };

    const handleCreateRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !householdId || amount <= 0 || !fromAccountId || !toAccountId) return;

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
            // MVP 데모용: 규칙 생성 시 임시로 이번 달 당월 '대기 중' 인스턴스를 하나 억지로 생성합니다 (원래는 Cron이 할 일)
            const targetDate = new Date();
            targetDate.setDate(transferDay);

            await supabase.from('auto_transfer_instances').insert([{
                household_id: householdId,
                rule_id: newRule.id,
                due_date: targetDate.toISOString().split('T')[0],
                expected_amount: amount,
                status: 'pending'
            }]);

            setIsModalOpen(false);
            setRuleName('');
            setAmount(0);
            fetchData(); // 갱신
            if (householdId) {
                queryClient.invalidateQueries({ queryKey: ['transactions', householdId] }); // 향후 Transactions 페이지 연동 고려
            }
        } else {
            alert('규칙 생성 실패: ' + error?.message);
        }
    };

    const confirmInstance = async (instance: AutoTransferInstance) => {
        if (!user || !instance.rule) return;

        // 사용자가 이체를 수동 확정 (실제 Transaction Entry 생성 + 상태 completed 변경)
        // 1. Entry 생성 (타입: transfer)
        const { data: memberData } = await supabase.from('household_members').select('household_id').eq('user_id', user.id).single();
        if (!memberData) return;

        const { data: entryData, error: entryError } = await supabase
            .from('transaction_entries')
            .insert([{
                household_id: memberData.household_id,
                occurred_at: instance.due_date || instance.target_date,
                entry_type: 'transfer',
                memo: `[자동이체] ${instance.rule.name}`,
                source: 'auto_transfer',
                created_by: user.id
            }])
            .select('id')
            .single();

        if (entryError || !entryData) {
            alert('트랜잭션 기록 실패: ' + (entryError?.message || '알 수 없는 오류'));
            return;
        }

        // 2. Lines 생성
        const { error: linesError } = await supabase.from('transaction_lines').insert([
            { entry_id: entryData.id, account_id: instance.rule.from_account_id, amount: -instance.rule.amount_expected },
            { entry_id: entryData.id, account_id: instance.rule.to_account_id, amount: instance.rule.amount_expected }
        ]);

        if (linesError) {
            alert('라인 기록 실패: ' + linesError.message);
            return;
        }

        // 3. 인스턴스 상태 업데이트
        const { error: updateError } = await supabase
            .from('auto_transfer_instances')
            .update({ status: 'completed', actual_entry_id: entryData.id })
            .eq('id', instance.id);

        if (updateError) {
            alert('상태 업데이트 실패: ' + updateError.message);
        } else {
            fetchData(); // 리프레시
            if (householdId) {
                queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
                queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
            }
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="space-y-8">
            {/* 1. 이체 확인 (Pending Instances) 공간 */}
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
                                            예정일: {new Date(inst.due_date || inst.target_date || '').toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className="font-medium text-gray-900 dark:text-white">{inst.rule?.amount_expected.toLocaleString()} 원</span>
                                        <button
                                            onClick={() => confirmInstance(inst)}
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

            {/* 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">새 자동이체 규칙 추가</h2>
                        <form onSubmit={handleCreateRule} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">규칙 이름</label>
                                <input type="text" value={ruleName} onChange={e => setRuleName(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" placeholder="예: 적금 이체" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-red-600">출금 계좌 (-)</label>
                                <select value={fromAccountId} onChange={e => setFromAccountId(Number(e.target.value))} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                    <option value="">선택</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-blue-600">입금 계좌 (+)</label>
                                <select value={toAccountId} onChange={e => setToAccountId(Number(e.target.value))} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                    <option value="">선택</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">이체 일자 (매월 N일)</label>
                                <input type="number" min="1" max="31" value={transferDay} onChange={e => setTransferDay(Number(e.target.value))} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">이체 금액</label>
                                <input type="number" min="0" value={amount} onChange={e => setAmount(Number(e.target.value))} required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                            </div>

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
