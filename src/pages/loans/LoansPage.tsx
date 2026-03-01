import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useLoans, useLoanRates, useLoanLedger } from '@/hooks/queries/useLoans';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import CurrencyInput from '@/components/ui/CurrencyInput';

/**
 * 대출 관리 페이지 (Sprint 7 — Phase 2)
 *
 * [PM 관점] Wireframe 3.9 구현:
 * - 대출 목록 (카드 형태)
 * - 대출 상세 (원장, 금리 이력)
 * - 대출 신규 생성 모달
 * - 추가상환 시뮬레이터 (클라이언트 계산)
 */
export default function LoansPage() {
    const { householdId } = useAuthStore();
    const queryClient = useQueryClient();
    const { data: loans, isLoading } = useLoans();
    const { data: accountsData } = useAccounts();
    const accounts = accountsData || [];

    // 선택된 대출 (상세 보기용)
    const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
    const selectedLoan = useMemo(() => loans?.find(l => l.id === selectedLoanId), [loans, selectedLoanId]);

    // 금리 이력 + 원장 조회
    const { data: rates } = useLoanRates(selectedLoanId);
    const { data: ledger } = useLoanLedger(selectedLoanId);

    // 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loanName, setLoanName] = useState('');
    const [principal, setPrincipal] = useState(0);
    const [startDate, setStartDate] = useState('');
    const [maturityDate, setMaturityDate] = useState('');
    const [termMonths, setTermMonths] = useState(12);
    const [repaymentType, setRepaymentType] = useState('annuity');
    const [payDay, setPayDay] = useState(25);
    const [initialRate, setInitialRate] = useState(0);
    const [linkedAccountId, setLinkedAccountId] = useState<number | ''>('');

    // 시뮬레이터 상태
    const [simPrepay, setSimPrepay] = useState(0);
    const [showSimulator, setShowSimulator] = useState(false);

    /** 대출 생성 핸들러 */
    const handleCreateLoan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!householdId || !loanName || principal <= 0 || initialRate <= 0) return;

        const { error } = await supabase.rpc('create_loan', {
            p_household_id: householdId,
            p_name: loanName,
            p_principal: principal,
            p_start_date: startDate,
            p_maturity_date: maturityDate,
            p_term_months: termMonths,
            p_repayment_type: repaymentType,
            p_interest_pay_day: payDay,
            p_initial_rate: initialRate / 100,
            p_linked_account_id: linkedAccountId || null,
        });

        if (error) { toast.error('생성 실패: ' + error.message); return; }
        setIsModalOpen(false);
        toast.success('대출이 정상적으로 등록되었습니다.');
        queryClient.invalidateQueries({ queryKey: ['loans', householdId] });
    };

    /** 추가상환 시뮬레이터 계산 */
    const simResult = useMemo(() => {
        if (!selectedLoan || !rates?.length || simPrepay <= 0) return null;

        const currentRate = rates[rates.length - 1].annual_rate;
        const currentBalance = ledger?.length
            ? ledger[ledger.length - 1].balance_after
            : selectedLoan.principal_original;
        const newBalance = Math.max(0, currentBalance - simPrepay);
        const monthlyRate = currentRate / 12;
        const remainMonths = selectedLoan.term_months - (ledger?.length || 1);

        // 기존 월 납입금
        const oldMonthly = monthlyRate > 0
            ? (currentBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -Math.max(1, remainMonths)))
            : currentBalance / Math.max(1, remainMonths);

        // 상환 후 월 납입금
        const newMonthly = monthlyRate > 0
            ? (newBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -Math.max(1, remainMonths)))
            : newBalance / Math.max(1, remainMonths);

        const savedInterest = (oldMonthly * Math.max(1, remainMonths)) - (newMonthly * Math.max(1, remainMonths)) - simPrepay;

        return {
            currentBalance,
            newBalance,
            oldMonthly: Math.round(oldMonthly),
            newMonthly: Math.round(newMonthly),
            savedMonthly: Math.round(oldMonthly - newMonthly),
            savedInterest: Math.round(Math.max(0, savedInterest)),
        };
    }, [selectedLoan, rates, ledger, simPrepay]);

    if (isLoading) return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">대출 관리</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">대출 현황, 금리 이력, 상환 스케줄을 관리합니다.</p>
                </div>
                <button onClick={() => setIsModalOpen(true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
                    새 대출 등록
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* 좌측: 대출 리스트 */}
                <div className="space-y-4">
                    {!loans?.length ? (
                        <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-400 dark:border-zinc-700">등록된 대출이 없습니다.</div>
                    ) : loans.map(loan => (
                        <button key={loan.id} onClick={() => { setSelectedLoanId(loan.id); setShowSimulator(false); }}
                            className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedLoanId === loan.id
                                ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/20'
                                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700'
                                }`}>
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-gray-900 dark:text-white">{loan.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${loan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {loan.is_active ? '상환중' : '완료'}
                                </span>
                            </div>
                            <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">₩{loan.principal_original.toLocaleString()}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{loan.start_date} ~ {loan.maturity_date} ({loan.term_months}개월)</p>
                        </button>
                    ))}
                </div>

                {/* 우측: 상세 (원장 + 금리 + 시뮬레이터) */}
                <div className="lg:col-span-2 space-y-4">
                    {!selectedLoan ? (
                        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400 dark:border-zinc-800 dark:bg-zinc-950">
                            좌측에서 대출을 선택하세요.
                        </div>
                    ) : (
                        <>
                            {/* 금리 이력 */}
                            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">📈 금리 이력</h3>
                                </div>
                                <div className="p-4">
                                    {!rates?.length ? <p className="text-sm text-gray-400">금리 이력이 없습니다.</p> : (
                                        <div className="space-y-2">
                                            {rates.map(r => (
                                                <div key={r.id} className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">{r.effective_date}~</span>
                                                    <span className="font-semibold text-gray-900 dark:text-white">{(r.annual_rate * 100).toFixed(2)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 원장 (상환 스케줄) */}
                            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-between dark:border-zinc-800 dark:bg-zinc-900/50">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">📋 상환 원장</h3>
                                    <button onClick={() => setShowSimulator(!showSimulator)}
                                        className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium">
                                        {showSimulator ? '원장 보기' : '🧮 시뮬레이터'}
                                    </button>
                                </div>

                                {showSimulator ? (
                                    /* 추가상환 시뮬레이터 */
                                    <div className="p-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">추가 상환 금액</label>
                                            <CurrencyInput value={simPrepay} onChange={setSimPrepay}
                                                className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                        </div>
                                        {simResult && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
                                                    <p className="text-xs text-gray-500">현재 잔액</p>
                                                    <p className="text-lg font-bold text-gray-900 dark:text-white">₩{simResult.currentBalance.toLocaleString()}</p>
                                                </div>
                                                <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/10">
                                                    <p className="text-xs text-gray-500">상환 후 잔액</p>
                                                    <p className="text-lg font-bold text-green-600 dark:text-green-400">₩{simResult.newBalance.toLocaleString()}</p>
                                                </div>
                                                <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
                                                    <p className="text-xs text-gray-500">월 납입금 감소</p>
                                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">-₩{simResult.savedMonthly.toLocaleString()}/월</p>
                                                </div>
                                                <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/10">
                                                    <p className="text-xs text-gray-500">절감 이자</p>
                                                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">₩{simResult.savedInterest.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* 원장 테이블 */
                                    <div className="max-h-80 overflow-y-auto">
                                        {!ledger?.length ? (
                                            <div className="p-4 text-sm text-gray-400">원장 데이터가 없습니다.</div>
                                        ) : (
                                            <table className="min-w-full text-sm">
                                                <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-900">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">일자</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">이자</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">원금</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">잔액</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                                    {ledger.map(entry => (
                                                        <tr key={entry.id}>
                                                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{entry.posting_date}</td>
                                                            <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">₩{entry.interest_amount.toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-right text-gray-900 dark:text-white">₩{entry.principal_amount.toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">₩{entry.balance_after.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 대출 생성 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">새 대출 등록</h2>
                        <form onSubmit={handleCreateLoan} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">대출명</label>
                                <input type="text" value={loanName} onChange={e => setLoanName(e.target.value)} required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">원금</label>
                                    <CurrencyInput value={principal} onChange={setPrincipal} required
                                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">연이율 (%)</label>
                                    <input type="number" step="0.01" value={initialRate} onChange={e => setInitialRate(Number(e.target.value))} required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">시작일</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">만기일</label>
                                    <input type="date" value={maturityDate} onChange={e => setMaturityDate(e.target.value)} required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">기간(개월)</label>
                                    <input type="number" value={termMonths} onChange={e => setTermMonths(Number(e.target.value))} required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">상환 방식</label>
                                    <select value={repaymentType} onChange={e => setRepaymentType(e.target.value)}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                        <option value="annuity">원리금균등</option>
                                        <option value="equal_principal">원금균등</option>
                                        <option value="interest_only">이자만</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">납입일</label>
                                    <input type="number" min={1} max={31} value={payDay} onChange={e => setPayDay(Number(e.target.value))}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">연결 계좌 (선택)</label>
                                <select value={linkedAccountId} onChange={e => setLinkedAccountId(Number(e.target.value) || '')}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                                    <option value="">미연결</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-zinc-700 dark:text-gray-300">취소</button>
                                <button type="submit"
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">등록</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
