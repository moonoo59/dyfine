import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import { CashFlowForecast, LoanPaymentDetail } from '@/hooks/queries/useCashFlowForecast';

/** 상환방식 한글 라벨 매핑 */
const REPAYMENT_LABELS: Record<string, string> = {
    annuity: '원리금균등',
    equal_principal: '원금균등',
    interest_only: '만기일시상환',
    bullet: '만기일시상환',
    graduated: '체증식',
    custom_schedule: '사용자정의',
};

interface LoanSimulatorPanelProps {
    loans: LoanPaymentDetail[];
    forecast: CashFlowForecast | null | undefined;
}

interface MonthlyRow {
    month: number;
    label: string;
    totalBalanceNormal: number;
    totalBalanceFast: number;
}

/** 일할이자 계산 (ACT/365) */
function calcDailyInterest(balance: number, annualRate: number, year: number, month: number, payDay: number): number {
    const start = new Date(year, month, payDay);
    const end = new Date(year, month + 1, payDay);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return balance * (annualRate / 365) * days;
}

/** 단일 월의 요구 원금 계산 */
function calcRequiredPrincipal(
    type: string,
    balance: number,
    interest: number,
    annualRate: number,
    remainMonths: number,
    elapsedMonths: number,
    graduatedRate: number,
): number {
    if (balance <= 0) return 0;
    const monthlyRate = annualRate / 12;

    switch (type) {
        case 'annuity': {
            const pmt = monthlyRate > 0
                ? (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainMonths))
                : balance / remainMonths;
            return Math.max(0, pmt - interest);
        }
        case 'equal_principal': {
            return balance / remainMonths;
        }
        case 'interest_only':
        case 'bullet': {
            if (remainMonths <= 1) return balance;
            return 0;
        }
        case 'graduated': {
            const basePmt = monthlyRate > 0
                ? (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainMonths))
                : balance / remainMonths;
            const yearsElapsed = Math.floor(elapsedMonths / 12);
            const adjustedPmt = basePmt * Math.pow(1 + graduatedRate, yearsElapsed);
            return Math.max(0, adjustedPmt - interest);
        }
        default:
            return 0;
    }
}

export default function LoanSimulatorPanel({ loans, forecast }: LoanSimulatorPanelProps) {
    const maxSlider = Math.max(forecast?.freeRouteSpace || 0, 2000000); // UI용 넉넉한 슬라이더 최대치
    const [extraMonthly, setExtraMonthly] = useState(Math.round((forecast?.freeRouteSpace || 500000)));

    // 워터폴 정렬 기준: 1.순위 오름차순(null은 뒤로), 2.이율 내림차순
    const sortedLoans = useMemo(() => {
        return [...loans].sort((a, b) => {
            const pA = a.repaymentPriority ?? 9999;
            const pB = b.repaymentPriority ?? 9999;
            if (pA !== pB) return pA - pB;
            return b.annualRate - a.annualRate;
        });
    }, [loans]);

    const { schedule, normalEnds, fastEnds, normalTotalInterest, fastTotalInterest } = useMemo(() => {
        const rows: MonthlyRow[] = [];
        const now = new Date();

        // 📝 상태 초기화
        const stateN = sortedLoans.map(l => ({ ...l, bal: l.currentBalance }));
        const stateF = sortedLoans.map(l => ({ ...l, bal: l.currentBalance }));
        const nEnds: Record<number, number> = {};
        const fEnds: Record<number, number> = {};

        let nTotalInt = 0;
        let fTotalInt = 0;

        // 최대 480개월 시뮬레이션
        for (let m = 1; m <= 480; m++) {
            const simDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
            const yr = simDate.getFullYear();
            const mo = simDate.getMonth();
            const label = `${yr}-${String(mo + 1).padStart(2, '0')}`;

            let totalBalN = 0;
            let dynamicBudgetM = extraMonthly;

            // ==========================================
            // [1] Normal Path 계산 및 Dynamic Budget 산출
            // ==========================================
            for (let i = 0; i < stateN.length; i++) {
                const s = stateN[i];
                if (s.bal <= 0) {
                    if (!nEnds[s.loanId]) nEnds[s.loanId] = m - 1;
                    continue;
                }

                const loanStart = new Date(s.start_date);
                const elapsedBase = Math.max(0, (now.getFullYear() - loanStart.getFullYear()) * 12 + now.getMonth() - loanStart.getMonth());
                const elapsed = elapsedBase + m;
                const remain = Math.max(1, s.term_months - elapsedBase - m + 1);

                const interest = calcDailyInterest(s.bal, s.annualRate, yr, mo, s.interest_pay_day || 25);
                nTotalInt += interest;

                const reqPrin = calcRequiredPrincipal(s.repaymentType, s.bal, interest, s.annualRate, remain, elapsed, s.graduated_increase_rate || 0.1);
                const actualPrin = Math.min(reqPrin, s.bal);

                s.bal = Math.max(0, s.bal - actualPrin);
                totalBalN += s.bal;

                // 해당 대출의 기본 상환액을 이번 달 총 예산(DynamicBudget)에 합산
                dynamicBudgetM += (interest + actualPrin);

                if (s.bal <= 0 && !nEnds[s.loanId]) nEnds[s.loanId] = m;
            }

            // ==========================================
            // [2] Fast Path (Waterfall) 계산
            // ==========================================
            let totalBalF = 0;
            let fInterestReq = 0;
            let fPrinReq = 0;

            // 2-1) 활성 대출들의 이자와 최소 원금 계산
            const reqsF = stateF.map(s => {
                if (s.bal <= 0) return { interest: 0, prin: 0, loanId: s.loanId };
                const loanStart = new Date(s.start_date);
                const elapsedBase = Math.max(0, (now.getFullYear() - loanStart.getFullYear()) * 12 + now.getMonth() - loanStart.getMonth());
                const elapsed = elapsedBase + m;
                const remain = Math.max(1, s.term_months - elapsedBase - m + 1);

                const interest = calcDailyInterest(s.bal, s.annualRate, yr, mo, s.interest_pay_day || 25);
                const reqPrin = calcRequiredPrincipal(s.repaymentType, s.bal, interest, s.annualRate, remain, elapsed, s.graduated_increase_rate || 0.1);

                return { interest, prin: Math.min(reqPrin, s.bal), loanId: s.loanId };
            });

            // 2-2) 이자 납부 및 최소원금 납부
            for (let i = 0; i < stateF.length; i++) {
                const s = stateF[i];
                if (s.bal <= 0) continue;
                const req = reqsF[i];
                fTotalInt += req.interest;
                fInterestReq += req.interest;
                fPrinReq += req.prin;

                s.bal = Math.max(0, s.bal - req.prin);
            }

            // 2-3) 잔여 Waterfall 예산 = 전체 예산 - 지불한 이자 - 지불한 최소원금
            let waterfallCash = Math.max(0, dynamicBudgetM - fInterestReq - fPrinReq);

            // 2-4) 워터폴 배분 (정렬된 우선순위대로 잔여금 투입)
            for (let i = 0; i < stateF.length; i++) {
                const s = stateF[i];
                if (s.bal <= 0) {
                    if (!fEnds[s.loanId]) fEnds[s.loanId] = m - 1;
                    continue;
                }

                if (waterfallCash > 0) {
                    const pay = Math.min(s.bal, waterfallCash);
                    s.bal = Math.max(0, s.bal - pay);
                    waterfallCash -= pay;
                }

                totalBalF += s.bal;
                if (s.bal <= 0 && !fEnds[s.loanId]) fEnds[s.loanId] = m;
            }

            rows.push({
                month: m,
                label,
                totalBalanceNormal: Math.round(totalBalN),
                totalBalanceFast: Math.round(totalBalF),
            });

            if (totalBalN <= 0 && totalBalF <= 0) break;
        }

        return {
            schedule: rows,
            normalEnds: nEnds,
            fastEnds: fEnds,
            normalTotalInterest: Math.round(nTotalInt),
            fastTotalInterest: Math.round(fTotalInt),
        };
    }, [sortedLoans, extraMonthly]);

    const chartData = useMemo(() => schedule.filter((_, i) => i % 3 === 0 || i === schedule.length - 1), [schedule]);

    const savedInterest = normalTotalInterest - fastTotalInterest;
    // 전체 Fast 종료일
    const overalFastEnd = Math.max(0, ...Object.values(fastEnds));
    const overalNormalEnd = Math.max(0, ...Object.values(normalEnds));

    if (!loans.length) {
        return <div className="p-8 text-center text-gray-500">활성 대출이 없습니다.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 dark:border-indigo-900/50 dark:bg-indigo-900/10">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="w-full sm:w-1/2">
                        <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 block mb-2">
                            🚀 매월 추가 상환액 (가용자금 투입)
                        </label>
                        <div className="flex items-center gap-3">
                            <input type="range" min={0} max={maxSlider} step={50000} value={extraMonthly}
                                onChange={e => setExtraMonthly(Number(e.target.value))}
                                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-300 dark:bg-zinc-700 accent-indigo-600" />
                            <span className="font-bold text-lg text-indigo-700 dark:text-indigo-400 whitespace-nowrap w-28 text-right">
                                ₩{(extraMonthly / 10000).toLocaleString()}만
                            </span>
                        </div>
                        {forecast && (
                            <p className="text-xs text-gray-500 mt-2">
                                현재 여유자금(FRS): ₩{(forecast.freeRouteSpace / 10000).toLocaleString()}만
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full sm:w-1/2">
                        <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <p className="text-xs text-gray-500 font-medium">✨ 절약 이자</p>
                            <p className="text-xl font-extrabold text-amber-500 mt-1">₩{savedInterest.toLocaleString()}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <p className="text-xs text-gray-500 font-medium">🗓 전체 완납 단축</p>
                            <p className="text-xl font-extrabold text-green-500 mt-1">{Math.max(0, overalNormalEnd - overalFastEnd)}개월</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 개별 대출 워터폴 요약 테이블 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">🌊 대출별 워터폴 소진 순서</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-500">
                            <tr>
                                <th className="px-5 py-3 text-left font-medium">순위</th>
                                <th className="px-5 py-3 text-left font-medium">대출명</th>
                                <th className="px-5 py-3 text-right font-medium">잔액</th>
                                <th className="px-5 py-3 text-right font-medium">상환방식</th>
                                <th className="px-5 py-3 text-right font-medium">기본 완납일</th>
                                <th className="px-5 py-3 text-right font-medium text-indigo-600 dark:text-indigo-400">조기 완납일</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {sortedLoans.map((l) => {
                                const nEndMo = normalEnds[l.loanId] || 0;
                                const fEndMo = fastEnds[l.loanId] || 0;
                                const nLabel = schedule[nEndMo - 1]?.label || '-';
                                const fLabel = schedule[fEndMo - 1]?.label || '-';
                                const faster = nEndMo - fEndMo;

                                return (
                                    <tr key={l.loanId} className="hover:bg-gray-50/50 dark:hover:bg-zinc-900/50">
                                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                                            {l.repaymentPriority ? <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold dark:bg-indigo-900/40 dark:text-indigo-300">{l.repaymentPriority}</span> : '-'}
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            {l.loanName}
                                            <span className="text-[10px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded dark:border-zinc-700">{(l.annualRate * 100).toFixed(2)}%</span>
                                        </td>
                                        <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">₩{l.currentBalance.toLocaleString()}</td>
                                        <td className="px-5 py-3 text-right text-gray-500 text-xs">{REPAYMENT_LABELS[l.repaymentType] || l.repaymentType}</td>
                                        <td className="px-5 py-3 text-right text-gray-500">{nLabel}</td>
                                        <td className="px-5 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                            {fLabel}
                                            {faster > 0 && <span className="ml-2 text-xs text-green-500 font-normal">(-{faster}개월)</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 차트 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="p-5 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v: any) => `₩${Number(v || 0).toLocaleString()}`} labelStyle={{ color: '#374151' }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line type="monotone" dataKey="totalBalanceNormal" stroke="#9ca3af" strokeWidth={2} name="기본 총 잔액" dot={false} />
                            <Line type="monotone" dataKey="totalBalanceFast" stroke="#4f46e5" strokeWidth={3} name="워터폴 조기상환 잔액" dot={false} />
                            <ReferenceLine y={0} stroke="#22c55e" strokeDasharray="4 4" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
