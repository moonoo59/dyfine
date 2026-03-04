import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useLoans, useLoanRates, useLoanLedger } from '@/hooks/queries/useLoans';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useCashFlowForecast } from '@/hooks/queries/useCashFlowForecast';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import CurrencyInput from '@/components/ui/CurrencyInput';
import LoanSimulatorPanel from '@/components/loans/LoanSimulatorPanel';

/**
 * 미래 월별 상환 스케줄 인터페이스
 */
interface FutureScheduleRow {
    month: number;
    date: string;
    interest: number;
    principal: number;
    payment: number;
    balance: number;
}
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
    const { data: cashFlowForecast } = useCashFlowForecast();

    // 선택된 대출 (상세 보기용)
    const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
    const selectedLoan = useMemo(() => loans?.find(l => l.id === selectedLoanId), [loans, selectedLoanId]);

    // 금리 이력 + 원장 조회
    const { data: rates } = useLoanRates(selectedLoanId);
    const { data: ledger } = useLoanLedger(selectedLoanId);

    // 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLoan, setEditingLoan] = useState<any>(null);

    const [loanName, setLoanName] = useState('');
    const [principal, setPrincipal] = useState(0);
    const [startDate, setStartDate] = useState('');
    const [maturityDate, setMaturityDate] = useState('');
    const [termMonths, setTermMonths] = useState(12);
    const [repaymentType, setRepaymentType] = useState('annuity');
    const [payDay, setPayDay] = useState(25);
    const [initialRate, setInitialRate] = useState(0); // 생성시에만 쓰임
    const [linkedAccountId, setLinkedAccountId] = useState<number | ''>('');
    const [bankName, setBankName] = useState('');
    const [repaymentPriority, setRepaymentPriority] = useState<number | ''>('');

    const openModalForNew = () => {
        setEditingLoan(null);
        setLoanName('');
        setPrincipal(0);
        setStartDate('');
        setMaturityDate('');
        setTermMonths(12);
        setRepaymentType('annuity');
        setPayDay(25);
        setInitialRate(0);
        setLinkedAccountId('');
        setBankName('');
        setRepaymentPriority('');
        setIsModalOpen(true);
    };

    const openModalForEdit = () => {
        if (!selectedLoan) return;
        setEditingLoan(selectedLoan);
        setLoanName(selectedLoan.name);
        setPrincipal(selectedLoan.principal_original);
        setStartDate(selectedLoan.start_date || '');
        setMaturityDate(selectedLoan.maturity_date || '');
        setTermMonths(selectedLoan.term_months || 12);
        setRepaymentType(selectedLoan.repayment_type || 'annuity');
        setPayDay(selectedLoan.interest_pay_day || 25);
        setInitialRate(0); // 수정 모드에서는 이력에서 따로 추가하므로 무시
        setLinkedAccountId(selectedLoan.linked_payment_account_id || '');
        setBankName(selectedLoan.bank_name || '');
        setRepaymentPriority(selectedLoan.repayment_priority || '');
        setIsModalOpen(true);
    };

    // 탭 전환: 원장 vs 미래스케줄 vs 시뮬레이터
    const [scheduleTab, setScheduleTab] = useState<'ledger' | 'future' | 'simulator'>('ledger');

    // 금리 추가 UI 상태
    const [showAddRate, setShowAddRate] = useState(false);
    const [newRateDate, setNewRateDate] = useState('');
    const [newRateValue, setNewRateValue] = useState(0);

    // 금리 추가 핸들러
    const handleAddRate = async () => {
        if (!selectedLoan || !newRateDate || newRateValue <= 0) return;
        const { error } = await supabase.from('loan_rate_history').insert([{
            loan_id: selectedLoan.id,
            effective_date: newRateDate,
            annual_rate: newRateValue / 100,
        }]);
        if (error) {
            toast.error('금리 추가 실패: ' + error.message);
        } else {
            toast.success('금리가 추가되었습니다.');
            setShowAddRate(false);
            setNewRateDate('');
            setNewRateValue(0);
            queryClient.invalidateQueries({ queryKey: ['loan_rates', selectedLoan.id] });
        }
    };

    // 현재 잔액 계산 (원장의 마지막 잔액 또는 초기 원금)
    const currentBalance = useMemo(() => {
        if (ledger && ledger.length > 0) {
            return ledger[ledger.length - 1].balance_after;
        }
        return selectedLoan?.principal_original || 0;
    }, [ledger, selectedLoan]);

    // 상환 진행률 (%)
    const repaymentProgress = useMemo(() => {
        if (!selectedLoan) return 0;
        const paid = selectedLoan.principal_original - currentBalance;
        return Math.min(100, Math.max(0, (paid / selectedLoan.principal_original) * 100));
    }, [selectedLoan, currentBalance]);

    // 총 납부 이자
    const totalInterestPaid = useMemo(() => {
        if (!ledger) return 0;
        return ledger.reduce((sum, e) => sum + e.interest_amount, 0);
    }, [ledger]);

    // 남은 개월 수
    const remainingMonths = useMemo(() => {
        if (!selectedLoan) return 0;
        const maturity = new Date(selectedLoan.maturity_date);
        const now = new Date();
        const diff = (maturity.getFullYear() - now.getFullYear()) * 12 + (maturity.getMonth() - now.getMonth());
        return Math.max(0, diff);
    }, [selectedLoan]);

    // 현재 금리 (최신 이력)
    const currentRate = useMemo(() => {
        if (!rates || rates.length === 0) return 0;
        return rates[rates.length - 1].annual_rate;
    }, [rates]);

    // 미래 상환 스케줄 계산 (클라이언트 사이드)
    const futureSchedule = useMemo<FutureScheduleRow[]>(() => {
        if (!selectedLoan || remainingMonths <= 0 || currentRate <= 0) return [];

        const rows: FutureScheduleRow[] = [];
        let balance = currentBalance;
        const monthlyRate = currentRate / 12;
        const type = selectedLoan.repayment_type;

        for (let m = 1; m <= remainingMonths && balance > 0; m++) {
            const interest = Math.round(balance * monthlyRate);
            let principalPayment = 0;
            let payment = 0;

            if (type === 'annuity') {
                // 원리금균등
                const totalPayment = Math.round(
                    balance * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths - m + 1)
                    / (Math.pow(1 + monthlyRate, remainingMonths - m + 1) - 1)
                );
                payment = totalPayment;
                principalPayment = payment - interest;
            } else if (type === 'equal_principal') {
                // 원금균등
                principalPayment = Math.round(currentBalance / remainingMonths);
                payment = principalPayment + interest;
            } else {
                // 만기일시상환 (interest_only)
                principalPayment = m === remainingMonths ? balance : 0;
                payment = interest + principalPayment;
            }

            balance = Math.max(0, balance - principalPayment);

            const d = new Date();
            d.setMonth(d.getMonth() + m);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            rows.push({ month: m, date: dateStr, interest, principal: principalPayment, payment, balance });
        }
        return rows;
    }, [selectedLoan, currentBalance, remainingMonths, currentRate]);

    /** 대출 생성/수정 핸들러 */
    const handleSaveLoan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!householdId || !loanName || principal <= 0) return;

        if (editingLoan) {
            const { error } = await supabase.from('loans').update({
                name: loanName,
                principal_original: principal,
                start_date: startDate,
                maturity_date: maturityDate,
                term_months: termMonths,
                repayment_type: repaymentType,
                interest_pay_day: payDay,
                linked_payment_account_id: linkedAccountId || null,
                bank_name: bankName || null,
                repayment_priority: Number(repaymentPriority) || null,
            }).eq('id', editingLoan.id);

            if (error) { toast.error('수정 실패: ' + error.message); return; }
            toast.success('대출 정보가 수정되었습니다.');
        } else {
            if (initialRate <= 0) return;
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
                p_bank_name: bankName || null,
                p_repayment_priority: Number(repaymentPriority) || null,
            });

            if (error) { toast.error('생성 실패: ' + error.message); return; }
            toast.success('대출이 정상적으로 등록되었습니다.');
        }

        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['loans', householdId] });
    };

    const handleDeleteLoan = async () => {
        if (!selectedLoan || !confirm('이 대출을 삭제하면 모든 금리 이력과 원장도 함께 삭제됩니다. 정말 삭제하시겠습니까?')) return;

        const { error } = await supabase.from('loans').delete().eq('id', selectedLoan.id);
        if (error) {
            toast.error('삭제 실패: ' + error.message);
        } else {
            toast.success('대출이 삭제되었습니다.');
            setSelectedLoanId(null);
            queryClient.invalidateQueries({ queryKey: ['loans', householdId] });
        }
    };

    if (isLoading) return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">대출 관리</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">대출 현황, 금리 이력, 상환 스케줄을 관리합니다.</p>
                </div>
                <button onClick={openModalForNew}
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
                        <button key={loan.id} onClick={() => { setSelectedLoanId(loan.id); setScheduleTab('ledger'); }}
                            className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedLoanId === loan.id
                                ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/20'
                                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700'
                                }`}>
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    {loan.bank_name && <span className="text-xs px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-600 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700">{loan.bank_name}</span>}
                                    {loan.name}
                                </span>
                                <div className="flex gap-1 items-center">
                                    {loan.repayment_priority && <span className="text-xs w-5 h-5 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold dark:bg-indigo-900/50 dark:text-indigo-300">{loan.repayment_priority}</span>}
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${loan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {loan.is_active ? '상환중' : '완료'}
                                    </span>
                                </div>
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
                            {/* 선택 대출 헤더 기능 (수정/삭제) */}
                            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedLoan.name}</h2>
                                    <p className="text-sm text-gray-500">{selectedLoan.principal_original.toLocaleString()} 원 · {selectedLoan.term_months}개월</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={openModalForEdit} className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400">수정</button>
                                    <button onClick={handleDeleteLoan} className="rounded-md bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400">삭제</button>
                                </div>
                            </div>

                            {/* 대출 요약 카드 */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">현재 잔액</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">₩{currentBalance.toLocaleString()}</p>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">상환 진행률</p>
                                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{repaymentProgress.toFixed(1)}%</p>
                                    <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-zinc-800">
                                        <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${repaymentProgress}%` }} />
                                    </div>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">납부 이자 합계</p>
                                    <p className="text-lg font-bold text-red-600 dark:text-red-400">₩{totalInterestPaid.toLocaleString()}</p>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">남은 기간 / 금리</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">{remainingMonths}개월 · {(currentRate * 100).toFixed(2)}%</p>
                                </div>
                            </div>

                            {/* 금리 이력 */}
                            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-between dark:border-zinc-800 dark:bg-zinc-900/50">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">📈 금리 이력</h3>
                                    <button onClick={() => setShowAddRate(!showAddRate)}
                                        className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium">
                                        {showAddRate ? '접기' : '+ 금리 추가'}
                                    </button>
                                </div>
                                <div className="p-4">
                                    {showAddRate && (
                                        <div className="mb-4 flex items-end gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-900/20">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">적용일</label>
                                                <input type="date" value={newRateDate} onChange={e => setNewRateDate(e.target.value)}
                                                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">연이율 (%)</label>
                                                <input type="number" step="0.01" value={newRateValue} onChange={e => setNewRateValue(Number(e.target.value))}
                                                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                            </div>
                                            <button onClick={handleAddRate}
                                                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">저장</button>
                                        </div>
                                    )}
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

                            {/* 상환 스케줄 (원장/미래/시뮬레이터 3탭) */}
                            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-between dark:border-zinc-800 dark:bg-zinc-900/50">
                                    <div className="flex gap-4">
                                        <button onClick={() => setScheduleTab('ledger')}
                                            className={`text-sm font-medium ${scheduleTab === 'ledger' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                            📋 원장 (실적)
                                        </button>
                                        <button onClick={() => setScheduleTab('future')}
                                            className={`text-sm font-medium ${scheduleTab === 'future' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                            📅 미래 스케줄
                                        </button>
                                        <button onClick={() => setScheduleTab('simulator')}
                                            className={`text-sm font-medium ${scheduleTab === 'simulator' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                            🧮 시뮬레이터
                                        </button>
                                    </div>
                                </div>

                                {scheduleTab === 'simulator' ? (
                                    <div className="p-4">
                                        <LoanSimulatorPanel
                                            loans={cashFlowForecast?.loanPayments || []}
                                            forecast={cashFlowForecast}
                                        />
                                    </div>
                                ) : scheduleTab === 'future' ? (
                                    <div className="max-h-96 overflow-y-auto">
                                        {futureSchedule.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-400">금리 이력이 없거나 남은 기간이 0입니다.</div>
                                        ) : (
                                            <table className="min-w-full text-sm">
                                                <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-900">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">월</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">납부액</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">이자</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">원금</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">잔액</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                                    {futureSchedule.map(row => (
                                                        <tr key={row.month}>
                                                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{row.date}</td>
                                                            <td className="px-4 py-2 text-right text-gray-900 dark:text-white">₩{row.payment.toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">₩{row.interest.toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-right text-gray-900 dark:text-white">₩{row.principal.toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">₩{row.balance.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-gray-50 dark:bg-zinc-900">
                                                    <tr>
                                                        <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">합계</td>
                                                        <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">₩{futureSchedule.reduce((s, r) => s + r.payment, 0).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-bold text-red-600 dark:text-red-400">₩{futureSchedule.reduce((s, r) => s + r.interest, 0).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">₩{futureSchedule.reduce((s, r) => s + r.principal, 0).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">-</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
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
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            {editingLoan ? '대출 수정' : '새 대출 등록'}
                        </h2>
                        <form onSubmit={handleSaveLoan} className="space-y-4">
                            <div className="grid grid-cols-6 gap-4">
                                <div className="col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">대출명</label>
                                    <input type="text" value={loanName} onChange={e => setLoanName(e.target.value)} required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">은행/기관명 (선택)</label>
                                    <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="예: 국민은행"
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" title="워터폴 상환 시 적용할 우선순위 (1이 최우선)">순위</label>
                                    <input type="number" min={1} value={repaymentPriority} onChange={e => setRepaymentPriority(Number(e.target.value) || '')} placeholder="1"
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">원금</label>
                                    <CurrencyInput value={principal} onChange={setPrincipal} required
                                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">연이율 (%)</label>
                                    <input type="number" step="0.01" value={initialRate} onChange={e => setInitialRate(Number(e.target.value))} required={!editingLoan} disabled={!!editingLoan}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                                    {editingLoan && <p className="text-xs text-gray-400 mt-1">금리는 금리 이력에서 관리하세요.</p>}
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
                                        <option value="interest_only">만기일시상환(거치식)</option>
                                        <option value="graduated">체증식</option>
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
