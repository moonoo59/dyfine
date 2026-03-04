import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import type { Loan } from '@/hooks/queries/useLoans';
import type { CashFlowForecast } from '@/hooks/queries/useCashFlowForecast';

/**
 * 대출 조기상환 & 미래 재무 시뮬레이터 패널 (v2 — 일할계산 + 4대 상환방식)
 *
 * [PM 관점] 핵심 변경사항:
 * 1. 일할이자 계산 (ACT/365) — 매월 실제 일수 기반 이자
 * 2. 4대 상환방식 지원: 원리금균등, 원금균등, 만기일시상환, 체증식
 * 3. 가처분 소득은 자동이체규칙+예산 기반 (3개월 평균 제거)
 * 4. 모든 금액이 유기적으로 참조됨
 *
 * [Designer 관점] 금융 앱답게 미니멀 + 데이터 중심
 */

/** 상환방식 한글 라벨 매핑 */
const REPAYMENT_LABELS: Record<string, string> = {
    annuity: '원리금균등',
    equal_principal: '원금균등',
    interest_only: '만기일시상환(거치식)',
    graduated: '체증식',
    custom_schedule: '사용자정의',
};

interface LoanSimulatorPanelProps {
    loan: Loan;
    currentBalance: number;
    annualRate: number;
    forecast: CashFlowForecast | null | undefined;
}

interface MonthlyRow {
    month: number;
    label: string;
    balanceNormal: number;
    balanceFast: number;
}

/**
 * 일할이자 계산 (ACT/365)
 * @param balance 원금 잔액
 * @param annualRate 연이율 (소수, 예: 0.045)
 * @param year 해당 연도
 * @param month 해당 월 (0-indexed)
 * @param payDay 이자 납입일 (1~31)
 */
function calcDailyInterest(balance: number, annualRate: number, year: number, month: number, payDay: number): number {
    // 이번 납입일 ~ 다음 납입일 사이 실제 일수
    const start = new Date(year, month, payDay);
    const end = new Date(year, month + 1, payDay);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return balance * (annualRate / 365) * days;
}

/**
 * 단일 월의 상환금 계산 (상환방식별)
 */
function calcMonthlyPayment(
    type: string,
    balance: number,
    interest: number,
    annualRate: number,
    remainMonths: number,
    elapsedMonths: number,
    graduatedRate: number,
): { principal: number; total: number } {
    if (balance <= 0) return { principal: 0, total: 0 };

    const monthlyRate = annualRate / 12;

    switch (type) {
        case 'annuity': {
            // 원리금균등: PMT 공식
            const pmt = monthlyRate > 0
                ? (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainMonths))
                : balance / remainMonths;
            const principal = Math.max(0, pmt - interest);
            return { principal, total: interest + principal };
        }
        case 'equal_principal': {
            // 원금균등: 매월 동일 원금 + 변동 이자
            const principal = balance / remainMonths;
            return { principal, total: interest + principal };
        }
        case 'interest_only': {
            // 이자만 / 만기일시상환
            // 만기(remainMonths=1)에만 원금 전액 상환
            if (remainMonths <= 1) {
                return { principal: balance, total: interest + balance };
            }
            return { principal: 0, total: interest };
        }
        case 'graduated': {
            // 체증식: 기본 PMT에 연차별 증가율 곱셈
            const basePmt = monthlyRate > 0
                ? (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainMonths))
                : balance / remainMonths;
            const yearsElapsed = Math.floor(elapsedMonths / 12);
            const adjustedPmt = basePmt * Math.pow(1 + graduatedRate, yearsElapsed);
            const principal = Math.max(0, adjustedPmt - interest);
            return { principal, total: interest + principal };
        }
        default:
            return { principal: 0, total: interest };
    }
}

export default function LoanSimulatorPanel({ loan, currentBalance, annualRate, forecast }: LoanSimulatorPanelProps) {
    const maxSlider = Math.max(forecast?.freeRouteSpace || 0, 100000);
    const [extraMonthly, setExtraMonthly] = useState(Math.round(maxSlider * 0.5));
    const [investReturnRate, setInvestReturnRate] = useState(8.0);
    // 중도상환수수료율 (사용자 입력, 기본 1.4%)
    const [prepaymentFeeRate, setPrepaymentFeeRate] = useState(1.4);

    // 대출 기본 정보
    const payDay = (loan as any).interest_pay_day || 25;
    const repayType = loan.repayment_type || 'annuity';
    const graduatedRate = Number((loan as any).graduated_increase_rate || 0.10);

    const loanStart = new Date(loan.start_date);
    const now = new Date();
    const elapsedBase = Math.max(0,
        (now.getFullYear() - loanStart.getFullYear()) * 12 + now.getMonth() - loanStart.getMonth()
    );
    const remainBase = Math.max(1, loan.term_months - elapsedBase);

    // ============================================================
    // 핵심 시뮬레이션 엔진 (일할이자 + 4대 상환방식)
    // ============================================================
    const { schedule, normalEnd, fastEnd, normalTotalInterest, fastTotalInterest } = useMemo(() => {
        const rows: MonthlyRow[] = [];
        let balN = currentBalance; // 기본 상환 경로
        let balF = currentBalance; // 조기 상환 경로
        let nEnd = remainBase;
        let fEnd = remainBase;
        let nInterestSum = 0;
        let fInterestSum = 0;
        let nDone = false;
        let fDone = false;

        // 최대 480개월(40년) 시뮬레이션
        for (let m = 1; m <= Math.min(loan.term_months + 120, 480); m++) {
            const simDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
            const yr = simDate.getFullYear();
            const mo = simDate.getMonth();
            const label = `${yr}-${String(mo + 1).padStart(2, '0')}`;
            const elapsed = elapsedBase + m;
            const remain = Math.max(1, loan.term_months - elapsedBase - m + 1);

            // --- 기본 경로 ---
            if (!nDone) {
                const interest = calcDailyInterest(balN, annualRate, yr, mo, payDay);
                nInterestSum += interest;
                const { principal } = calcMonthlyPayment(repayType, balN, interest, annualRate, remain, elapsed, graduatedRate);
                const actualPrincipal = Math.min(principal, balN);
                balN = Math.max(0, balN - actualPrincipal);
                if (balN <= 0 || remain <= 1) { nDone = true; nEnd = m; balN = 0; }
            }

            // --- 조기상환 경로 (추가상환분 원금에 직접 투입) ---
            if (!fDone) {
                const interest = calcDailyInterest(balF, annualRate, yr, mo, payDay);
                fInterestSum += interest;
                const { principal } = calcMonthlyPayment(repayType, balF, interest, annualRate, remain, elapsed, graduatedRate);
                const totalPrincipal = Math.min(principal + extraMonthly, balF);
                balF = Math.max(0, balF - totalPrincipal);
                if (balF <= 0) { fDone = true; fEnd = m; balF = 0; }
            }

            rows.push({
                month: m,
                label,
                balanceNormal: Math.round(balN),
                balanceFast: Math.round(balF),
            });

            if (nDone && fDone) break;
        }

        return {
            schedule: rows,
            normalEnd: nEnd,
            fastEnd: fEnd,
            normalTotalInterest: Math.round(nInterestSum),
            fastTotalInterest: Math.round(fInterestSum),
        };
    }, [currentBalance, annualRate, extraMonthly, remainBase, elapsedBase, loan.term_months, repayType, payDay, graduatedRate]);

    // 기회비용 비교
    const opCost = useMemo(() => {
        const monthlyInvRate = (investReturnRate / 100) / 12;
        const months = normalEnd;

        // A: 빨리 갚고 → 남은 기간 투자
        let investA = 0;
        const paymentPerMonth = extraMonthly + (normalTotalInterest / normalEnd); // 대략적 월납입
        for (let i = 0; i < (months - fastEnd); i++) {
            investA = (investA + paymentPerMonth + extraMonthly) * (1 + monthlyInvRate);
        }

        // B: 천천히 갚고 → 잉여금을 처음부터 투자
        let investB = 0;
        for (let i = 0; i < months; i++) {
            investB = (investB + extraMonthly) * (1 + monthlyInvRate);
        }

        return {
            netA: Math.round(investA),
            netB: Math.round(investB),
            better: investA >= investB ? 'A' as const : 'B' as const,
        };
    }, [normalEnd, fastEnd, normalTotalInterest, extraMonthly, investReturnRate]);

    const chartData = useMemo(() =>
        schedule.filter((_, i) => i % 3 === 0 || i === schedule.length - 1)
        , [schedule]);

    const savedMonths = normalEnd - fastEnd;
    const savedInterest = normalTotalInterest - fastTotalInterest;
    // 중도상환수수료 총액 (추가상환분 × 수수료율 × 조기상환 기간)
    const totalPrepaymentFee = Math.round(extraMonthly * (prepaymentFeeRate / 100) * fastEnd);
    // 수수료 차감 후 실질 절약 이자
    const netSavedInterest = Math.max(0, savedInterest - totalPrepaymentFee);

    return (
        <div className="space-y-6">
            {/* === 가처분 소득 요약 === */}
            {forecast && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            💰 월 현금흐름 분석 <span className="text-xs font-normal text-gray-400 ml-2">({forecast.dataSource})</span>
                        </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
                        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/10">
                            <p className="text-xs text-gray-500">고정 수입</p>
                            <p className="text-base font-bold text-blue-600 dark:text-blue-400">₩{forecast.fixedIncome.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/10">
                            <p className="text-xs text-gray-500">고정 지출</p>
                            <p className="text-base font-bold text-red-600 dark:text-red-400">₩{forecast.fixedExpense.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-900/10">
                            <p className="text-xs text-gray-500">변동 예산</p>
                            <p className="text-base font-bold text-orange-600 dark:text-orange-400">₩{forecast.budgetedExpense.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/10">
                            <p className="text-xs text-gray-500">대출 납입</p>
                            <p className="text-base font-bold text-purple-600 dark:text-purple-400">₩{forecast.totalLoanPayment.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-green-50 p-3 ring-2 ring-green-200 dark:bg-green-900/10 dark:ring-green-800">
                            <p className="text-xs font-semibold text-green-700 dark:text-green-300">🔑 가용자금</p>
                            <p className="text-lg font-extrabold text-green-600 dark:text-green-400">₩{forecast.freeRouteSpace.toLocaleString()}</p>
                        </div>
                    </div>
                    {/* 대출별 납입 상세 */}
                    {forecast.loanPayments.length > 1 && (
                        <div className="border-t border-gray-100 px-4 py-3 dark:border-zinc-800">
                            <p className="text-xs font-medium text-gray-500 mb-2">대출별 납입 상세 (일할이자 ACT/365)</p>
                            <div className="space-y-1">
                                {forecast.loanPayments.map(lp => (
                                    <div key={lp.loanId} className="flex items-center justify-between text-xs">
                                        <span className="text-gray-600 dark:text-gray-400">
                                            {lp.loanName} <span className="text-gray-400">({REPAYMENT_LABELS[lp.repaymentType] || lp.repaymentType})</span>
                                        </span>
                                        <span className="text-gray-800 dark:text-gray-200">
                                            이자 ₩{lp.interestAmount.toLocaleString()} + 원금 ₩{lp.principalAmount.toLocaleString()} = <strong>₩{lp.monthlyPayment.toLocaleString()}</strong>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* === 시뮬레이터: 상환방식 표시 & 슬라이더 === */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">🧮 조기상환 시뮬레이터</h3>
                    <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                        {REPAYMENT_LABELS[repayType] || repayType} · {(annualRate * 100).toFixed(2)}% · 일할계산
                    </span>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">매월 추가 상환</label>
                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">₩{extraMonthly.toLocaleString()}</span>
                        </div>
                        <input type="range" min={0} max={maxSlider} step={10000} value={extraMonthly}
                            onChange={e => setExtraMonthly(Number(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-indigo-600" />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>₩0</span>
                            <span>₩{maxSlider.toLocaleString()}</span>
                        </div>
                    </div>
                    {/* 중도상환수수료율 입력 */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">중도상환수수료율</label>
                            <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{prepaymentFeeRate}%</span>
                        </div>
                        <input type="range" min={0} max={3} step={0.1} value={prepaymentFeeRate}
                            onChange={e => setPrepaymentFeeRate(Number(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-rose-500" />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>0%</span>
                            <span>3%</span>
                        </div>
                    </div>

                    {/* KPI 6개 */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg bg-gray-50 p-3 dark:bg-zinc-900">
                            <p className="text-xs text-gray-500">현재 잔액</p>
                            <p className="text-base font-bold text-gray-900 dark:text-white">₩{currentBalance.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/10">
                            <p className="text-xs text-gray-500">총 이자 (기본)</p>
                            <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">₩{normalTotalInterest.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/10">
                            <p className="text-xs text-gray-500">🗓️ 단축 기간</p>
                            <p className="text-base font-bold text-green-600 dark:text-green-400">{savedMonths}개월 ({(savedMonths / 12).toFixed(1)}년)</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/10">
                            <p className="text-xs text-gray-500">💸 절약 이자 (총)</p>
                            <p className="text-base font-bold text-amber-600 dark:text-amber-400">₩{savedInterest.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-900/10">
                            <p className="text-xs text-gray-500">⚠️ 중도상환수수료</p>
                            <p className="text-base font-bold text-rose-600 dark:text-rose-400">-₩{totalPrepaymentFee.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50 p-3 ring-2 ring-emerald-200 dark:bg-emerald-900/10 dark:ring-emerald-800">
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">✅ 실질 절약</p>
                            <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">₩{netSavedInterest.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* 완납일 비교 */}
                    <div className="flex items-center justify-center gap-8 text-center py-2">
                        <div>
                            <p className="text-xs text-gray-500">기본 완납</p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{schedule[normalEnd - 1]?.label || '—'}</p>
                            <p className="text-xs text-gray-400">{normalEnd}개월</p>
                        </div>
                        <div className="text-2xl text-green-500">→</div>
                        <div>
                            <p className="text-xs text-green-600 dark:text-green-400 font-semibold">조기 완납</p>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">{schedule[fastEnd - 1]?.label || '—'}</p>
                            <p className="text-xs text-green-500">{fastEnd}개월</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 원금 소진 비교 차트 === */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">📉 원금 소진 비교</h3>
                </div>
                <div className="p-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: any) => `₩${Number(v || 0).toLocaleString()}`} />
                            <Legend />
                            <Line type="monotone" dataKey="balanceNormal" stroke="#9ca3af" strokeWidth={2} name="기본 상환" dot={false} />
                            <Line type="monotone" dataKey="balanceFast" stroke="#6366f1" strokeWidth={3} name="조기 상환" dot={false} />
                            <ReferenceLine y={0} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '완납', fill: '#22c55e', fontSize: 12 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* === 기회비용 비교 === */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">⚖️ 기회비용: 상환 vs 투자</h3>
                </div>
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">투자 기대수익률</label>
                        <input type="range" min={1} max={20} step={0.5} value={investReturnRate}
                            onChange={e => setInvestReturnRate(Number(e.target.value))}
                            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-emerald-500" />
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 w-12 text-right">{investReturnRate}%</span>
                    </div>
                    <p className="text-xs text-gray-500">
                        대출이율 <strong>{(annualRate * 100).toFixed(2)}%</strong> vs 투자 <strong>{investReturnRate}%</strong> — {normalEnd}개월간 매월 ₩{extraMonthly.toLocaleString()} 비교
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className={`rounded-xl p-5 border-2 ${opCost.better === 'A' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-600' : 'border-gray-200 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-700'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {opCost.better === 'A' && <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold dark:bg-emerald-800 dark:text-emerald-200">유리</span>}
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">A. 대출 먼저 갚기</p>
                            </div>
                            <p className="text-xs text-gray-500">{fastEnd}개월에 완납 → 이후 투자</p>
                            <p className="text-xl font-extrabold mt-2 text-gray-900 dark:text-white">₩{opCost.netA.toLocaleString()}</p>
                        </div>
                        <div className={`rounded-xl p-5 border-2 ${opCost.better === 'B' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-600' : 'border-gray-200 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-700'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {opCost.better === 'B' && <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold dark:bg-emerald-800 dark:text-emerald-200">유리</span>}
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">B. 투자하면서 갚기</p>
                            </div>
                            <p className="text-xs text-gray-500">{normalEnd}개월간 매월 ₩{extraMonthly.toLocaleString()} 투자</p>
                            <p className="text-xl font-extrabold mt-2 text-gray-900 dark:text-white">₩{opCost.netB.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs text-center text-gray-400">※ 투자 수익률은 보장되지 않습니다. 시뮬레이션 참고용.</p>
                </div>
            </div>
        </div>
    );
}
