import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useClosingHistory } from '@/hooks/queries/useClosingHistory';
import { useTransferInstances } from '@/hooks/queries/useTransferInstances';
import { useBudgets } from '@/hooks/queries/useBudgets';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import MonthPicker from '@/components/ui/MonthPicker';
import { toast } from 'react-hot-toast';

/**
 * 월 마감(Closing) 페이지 컴포넌트
 *
 * [PM 관점] PRD F5 요구사항 구현:
 * - 마감 전 체크: 미확인 자동이체 경고, 예산 초과 항목 확인
 * - 마감 실행: Supabase RPC(close_month)로 전표 락 + 스냅샷 저장
 * - 마감 이력: 과거 마감 기록 및 요약 열람
 *
 * [Reviewer 관점] 에지케이스 처리:
 * - 이미 마감된 월 재마감 방지 (서버 + 클라이언트 이중 체크)
 * - 미확인 자동이체가 있을 경우 경고 후 사용자 확인
 */
export default function ClosingPage() {
    const { user, householdId } = useAuthStore();
    const queryClient = useQueryClient();

    // 마감 이력 조회 (React Query)
    const { data: closingHistory, isLoading: historyLoading } = useClosingHistory();
    const closings = closingHistory || [];

    // 미확인 자동이체 조회 (마감 전 체크용)
    const { data: pendingInstances } = useTransferInstances();
    const pendingCount = pendingInstances?.length || 0;

    // 월 선택 상태
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

    // 선택 월의 예산 데이터 조회 (초과 항목 체크용)
    const { data: budgetData } = useBudgets(selectedYear, selectedMonth);
    const templates = budgetData?.templates || [];
    const performances = budgetData?.performances || {};

    // 마감 진행 상태
    const [closing, setClosing] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // 선택 월의 year_month 문자열 (예: '2026-02')
    const yearMonth = useMemo(() => {
        return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    }, [selectedYear, selectedMonth]);

    // 선택 월이 이미 마감되었는지 확인
    const isAlreadyClosed = useMemo(() => {
        return closings.some(c => c.year_month === yearMonth);
    }, [closings, yearMonth]);

    // 선택 월의 마감 요약 (이미 마감된 경우)
    const closedSummary = useMemo(() => {
        return closings.find(c => c.year_month === yearMonth);
    }, [closings, yearMonth]);

    // 대출 납입액 미연결(납입 누락) 항목 조회 (현재 활성 대출 기준 간이 체크)
    const { data: pendingLoansData } = useQuery({
        queryKey: ['pendingLoans', householdId, yearMonth],
        queryFn: async () => {
            if (!householdId) return 0;
            // 이번 달에 활성화된 대출 목록을 가져온 후, transaction_entries에 해당 대출 연결 건이 있는지 간이 체크
            // (실제 프로덕션에서는 loan_ledger_entries 상태를 확인하는 것이 더 정확함)
            const { data: loans } = await supabase
                .from('loans')
                .select('id')
                .eq('household_id', householdId)
                .eq('is_active', true);

            // 단순화를 위해 현재 활성 대출 건수를 반환하고, 이번 달 지출 내역 중 '대출' 관련 메모가 없으면 경고
            const { data: txns } = await supabase
                .from('transaction_entries')
                .select('id')
                .eq('household_id', householdId)
                .gte('occurred_at', `${yearMonth}-01`)
                .lte('occurred_at', `${yearMonth}-31T23:59:59`)
                .or('memo.ilike.%대출%,memo.ilike.%상환%');

            const hasLoanPayments = txns && txns.length > 0;
            const activeLoansCount = loans?.length || 0;

            // 활성 대출이 있는데 이번 달 상환 내역이 없으면 누락으로 간주 (간이 체크)
            return activeLoansCount > 0 && !hasLoanPayments ? activeLoansCount : 0;
        },
        enabled: !!householdId,
    });
    const pendingLoanWarnings = pendingLoansData || 0;

    // 예산 초과 항목 계산
    const overBudgetItems = useMemo(() => {
        return templates
            .filter(tpl => (performances[tpl.category_id] || 0) > tpl.monthly_amount)
            .map(tpl => ({
                categoryName: tpl.category?.name || '알수없음',
                budget: tpl.monthly_amount,
                actual: performances[tpl.category_id] || 0,
            }));
    }, [templates, performances]);

    // 월 변경 핸들러 (MonthPicker에서 호출)
    const handleMonthChange = (y: number, m: number) => {
        setSelectedYear(y);
        setSelectedMonth(m);
    };

    /**
     * 마감 실행 핸들러
     * - Supabase RPC(close_month) 호출
     * - 성공 시 캐시 무효화 (closings, dashboard, transactions)
     */
    const handleCloseMonth = async () => {
        if (!user || !householdId) return;
        setClosing(true);
        setShowConfirmDialog(false);

        try {
            const { data, error } = await supabase.rpc('close_month', {
                p_year_month: yearMonth,
                p_user_id: user.id,
            });

            if (error) throw error;

            // 투자 코어: 월 마감 시 투자 자산 스냅샷 동시 생성
            // 마감 월의 마지막 날짜를 구해서 스냅샷 날짜로 지정
            const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
            await supabase.rpc('update_holding_snapshot', {
                p_household_id: householdId,
                p_snapshot_date: lastDayOfMonth,
            });

            // 캐시 무효화
            queryClient.invalidateQueries({ queryKey: ['closings', householdId] });
            queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] });
            queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });

            toast.success(`${yearMonth} 마감이 완료되었습니다!\n전표 ${(data as any)?.locked_count || 0}건이 잠금 처리되었습니다.`);
        } catch (err: any) {
            toast.error('마감 실패: ' + (err.message || '알 수 없는 오류'));
        } finally {
            setClosing(false);
        }
    };

    if (historyLoading) {
        return <div className="p-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="space-y-8">
            {/* 상단 헤더 */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">월 마감</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    월별 전표를 마감하여 수정을 방지하고, 요약 스냅샷을 보존합니다.
                </p>
            </div>

            {/* 월 선택기 (공통 컴포넌트) */}
            <MonthPicker year={selectedYear} month={selectedMonth} onChange={handleMonthChange} />

            {/* 이미 마감된 월인 경우 */}
            {isAlreadyClosed && closedSummary ? (
                <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-6 dark:border-green-900/30 dark:bg-green-900/10">
                    <div className="flex items-center space-x-2 mb-4">
                        <span className="text-2xl">🔒</span>
                        <h2 className="text-lg font-bold text-green-800 dark:text-green-400">마감 완료</h2>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                        {new Date(closedSummary.closed_at).toLocaleString('ko-KR')}에 마감되었습니다.
                    </p>

                    {/* 마감 요약 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                            <p className="text-xs text-gray-500 dark:text-gray-400">수입</p>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                ₩{(closedSummary.summary_json.total_income || 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                            <p className="text-xs text-gray-500 dark:text-gray-400">지출</p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-400">
                                ₩{(closedSummary.summary_json.total_expense || 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                            <p className="text-xs text-gray-500 dark:text-gray-400">순증감</p>
                            <p className={`text-lg font-bold ${(closedSummary.summary_json.net_change || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                ₩{(closedSummary.summary_json.net_change || 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                            <p className="text-xs text-gray-500 dark:text-gray-400">전표 건수</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {closedSummary.summary_json.entry_count || 0}건
                            </p>
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                        ※ 마감된 월의 전표는 수정/삭제할 수 없습니다. 수정이 필요하면 '조정 전표'를 거래 내역에서 입력하세요.
                    </p>
                </div>
            ) : (
                /* 아직 마감되지 않은 월 */
                <div className="space-y-6">
                    {/* 마감 전 체크: 미확인 자동이체 경고 */}
                    {pendingCount > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/30 dark:bg-amber-900/10">
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="text-xl">⚠️</span>
                                <h3 className="text-base font-bold text-amber-800 dark:text-amber-400">미확인 자동이체 경고</h3>
                            </div>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                아직 확인되지 않은 자동이체가 <strong>{pendingCount}건</strong> 있습니다.
                                마감하면 이 항목들은 확인 없이 남게 됩니다.
                            </p>
                        </div>
                    )}

                    {/* 마감 전 체크: 대출 납입 누락 경고 */}
                    {pendingLoanWarnings > 0 && (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900/30 dark:bg-indigo-900/10 mt-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="text-xl">📝</span>
                                <h3 className="text-base font-bold text-indigo-800 dark:text-indigo-400">대출 납입 연결 누락 경고</h3>
                            </div>
                            <p className="text-sm text-indigo-700 dark:text-indigo-300">
                                활성화된 대출이 <strong>{pendingLoanWarnings}건</strong> 있지만, 이번 달 대출 상환 거래 내역이 없습니다.
                                마감 전 대출 납입 내역을 확인하고 등록해주세요.
                            </p>
                        </div>
                    )}

                    {/* 마감 전 체크: 예산 초과 항목 */}
                    {overBudgetItems.length > 0 && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/30 dark:bg-red-900/10">
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="text-xl">🚨</span>
                                <h3 className="text-base font-bold text-red-800 dark:text-red-400">예산 초과 항목</h3>
                            </div>
                            <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
                                {overBudgetItems.map((item, idx) => (
                                    <li key={idx}>
                                        <strong>{item.categoryName}</strong>: ₩{item.actual.toLocaleString()} / ₩{item.budget.toLocaleString()} (초과 ₩{(item.actual - item.budget).toLocaleString()})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 마감 실행 버튼 */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            {selectedYear}년 {selectedMonth}월 마감하기
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            마감을 실행하면 해당 월의 모든 전표가 <strong>잠금(Lock)</strong> 처리됩니다.
                            이후 수정이 필요한 경우 '조정 전표(Adjustment)'로만 반영할 수 있습니다.
                        </p>

                        <button
                            onClick={() => setShowConfirmDialog(true)}
                            disabled={closing}
                            className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors dark:focus:ring-offset-zinc-900"
                        >
                            {closing ? '마감 처리 중...' : `${yearMonth} 마감 실행`}
                        </button>
                    </div>
                </div>
            )}

            {/* 마감 이력 리스트 */}
            <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">마감 이력</h2>
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                    {closings.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            아직 마감된 월이 없습니다.
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {closings.map(c => (
                                <li key={c.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                            {c.year_month.replace('-', '년 ')}월
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            마감일: {new Date(c.closed_at).toLocaleString('ko-KR')}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-4 text-sm">
                                        <span className="text-blue-600 dark:text-blue-400">
                                            +₩{(c.summary_json?.total_income || 0).toLocaleString()}
                                        </span>
                                        <span className="text-red-600 dark:text-red-400">
                                            -₩{(c.summary_json?.total_expense || 0).toLocaleString()}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium dark:bg-green-900/30 dark:text-green-400">
                                            🔒 마감
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* 마감 확인 다이얼로그 */}
            {showConfirmDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">마감 확인</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            <strong>{yearMonth}</strong> 월의 모든 전표가 잠금 처리됩니다.
                            {pendingCount > 0 && (
                                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                                    ⚠️ 미확인 자동이체 {pendingCount}건이 아직 남아있습니다.
                                </span>
                            )}
                            {pendingLoanWarnings > 0 && (
                                <span className="block mt-2 text-indigo-600 dark:text-indigo-400">
                                    📝 대출 납입 연결 누락 가능성 ({pendingLoanWarnings}건 활성화됨)
                                </span>
                            )}
                            이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-zinc-700 dark:text-gray-300"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleCloseMonth}
                                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                            >
                                마감 실행
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
