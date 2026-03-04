import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import type { Loan } from '@/hooks/queries/useLoans';
import type { CashFlowForecast } from '@/hooks/queries/useCashFlowForecast';

/**
 * 대출 조기상환 시뮬레이터 패널 (Sprint 9 — 미래 재무 플래닝)
 *
 * [PM 관점] 핵심 기능:
 * 1. 가처분 소득(FRS) 기반으로 슬라이더 최대치 자동 설정
 * 2. 슬라이더 조작 시 "기본 상환 vs 조기 상환" 원금 소진 비교 차트 실시간 렌더링
 * 3. 절약되는 총 이자, 단축된 기간 등 핵심 KPI 카드 표시
 * 4. 2단계: 대출상환 vs 투자 기회비용 비교
 *
 * [Designer 관점] 금융 앱답게 미니멀하고 데이터 중심의 UI
 */
interface LoanSimulatorPanelProps {
    /** 선택된 대출 정보 */
    loan: Loan;
    /** 현재 대출 잔액 (원장 기반) */
    currentBalance: number;
    /** 현재 연이율 (최신 금리 이력 기반) */
    annualRate: number;
    /** 가처분 소득 예측 데이터 */
    forecast: CashFlowForecast | null | undefined;
}

/** 월별 시뮬레이션 결과 하나 */
interface MonthlyScheduleRow {
    month: number;
    label: string; // 'YYYY-MM' 형식
    balanceNormal: number;
    balanceFast: number;
}

export default function LoanSimulatorPanel({ loan, currentBalance, annualRate, forecast }: LoanSimulatorPanelProps) {
    // 매월 추가 상환 금액 (슬라이더 조절)
    const maxSlider = forecast?.freeRouteSpace || 1000000;
    const [extraMonthly, setExtraMonthly] = useState(Math.round(maxSlider * 0.5));

    // 투자 기대수익률 (기회비용 비교용)
    const [investReturnRate, setInvestReturnRate] = useState(8.0);

    const monthlyRate = annualRate / 12;

    // 남은 기간 계산
    const elapsedMonths = useMemo(() => {
        const start = new Date(loan.start_date);
        const now = new Date();
        return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
    }, [loan.start_date]);

    const remainMonths = Math.max(1, loan.term_months - elapsedMonths);

    // 기본 월 납입금 (원리금 균등 기준 PMT)
    const baseMonthlyPayment = useMemo(() => {
        if (monthlyRate <= 0) return Math.round(currentBalance / remainMonths);
        return Math.round(
            (currentBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainMonths))
        );
    }, [currentBalance, monthlyRate, remainMonths]);

    // === 핵심: 월별 상환 시뮬레이션 (기본 vs 추가상환) ===
    const { schedule, normalEndMonth, fastEndMonth, normalTotalInterest, fastTotalInterest } = useMemo(() => {
        const rows: MonthlyScheduleRow[] = [];
        let balNormal = currentBalance;
        let balFast = currentBalance;
        let normalEnd = remainMonths;
        let fastEnd = remainMonths;
        let normalInterestTotal = 0;
        let fastInterestTotal = 0;
        let normalDone = false;
        let fastDone = false;

        const now = new Date();

        // 최대 360개월(30년)까지 시뮬레이션
        for (let m = 1; m <= Math.min(remainMonths + 60, 360); m++) {
            const labelDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
            const label = `${labelDate.getFullYear()}-${String(labelDate.getMonth() + 1).padStart(2, '0')}`;

            // --- 기본 상환 경로 ---
            if (!normalDone) {
                const interestNormal = balNormal * monthlyRate;
                normalInterestTotal += interestNormal;
                let principalNormal = baseMonthlyPayment - interestNormal;
                if (principalNormal >= balNormal) {
                    principalNormal = balNormal;
                    normalDone = true;
                    normalEnd = m;
                }
                balNormal = Math.max(0, balNormal - principalNormal);
            }

            // --- 추가 상환 경로 ---
            if (!fastDone) {
                const interestFast = balFast * monthlyRate;
                fastInterestTotal += interestFast;
                let principalFast = (baseMonthlyPayment + extraMonthly) - interestFast;
                if (principalFast >= balFast) {
                    principalFast = balFast;
                    fastDone = true;
                    fastEnd = m;
                }
                balFast = Math.max(0, balFast - principalFast);
            }

            rows.push({
                month: m,
                label,
                balanceNormal: Math.round(balNormal),
                balanceFast: Math.round(balFast),
            });

            if (normalDone && fastDone) break;
        }

        return {
            schedule: rows,
            normalEndMonth: normalEnd,
            fastEndMonth: fastEnd,
            normalTotalInterest: Math.round(normalInterestTotal),
            fastTotalInterest: Math.round(fastInterestTotal),
        };
    }, [currentBalance, monthlyRate, baseMonthlyPayment, extraMonthly, remainMonths]);

    // === 기회비용: 같은 금액을 투자했을 때의 자산 비교 ===
    const opportunityCost = useMemo(() => {
        const monthlyInvestRate = (investReturnRate / 100) / 12;
        // investEndMonth을 fastEndMonth에 맞춤 (대출 완료까지의 기간)
        const months = normalEndMonth;

        // 시나리오A: 대출 빨리 갚기 (추가상환 투입)
        // → 대출 빨리 끝남. fastEndMonth 이후 남은 기간의 월납입+추가상환분을 투자
        let investAfterPayoff = 0;
        const monthsAfterPayoff = months - fastEndMonth;
        const monthlyAfterPayoff = baseMonthlyPayment + extraMonthly;
        for (let i = 0; i < monthsAfterPayoff; i++) {
            investAfterPayoff = (investAfterPayoff + monthlyAfterPayoff) * (1 + monthlyInvestRate);
        }

        // 시나리오B: 대출 천천히 갚기 (잉여자금을 투자에 투입)
        let investFromStart = 0;
        for (let i = 0; i < months; i++) {
            investFromStart = (investFromStart + extraMonthly) * (1 + monthlyInvestRate);
        }

        // 순자산(Net Worth) 비교
        // A: 부채 0 + 투자액
        const netWorthA = investAfterPayoff;
        // B: 투자액 - 남은 부채(=0, 기본은 만기에 정상종료)
        const netWorthB = investFromStart;

        return {
            scenarioA_invest: Math.round(investAfterPayoff),
            scenarioB_invest: Math.round(investFromStart),
            netWorthA: Math.round(netWorthA),
            netWorthB: Math.round(netWorthB),
            betterOption: netWorthA >= netWorthB ? 'A' : 'B' as 'A' | 'B',
        };
    }, [normalEndMonth, fastEndMonth, baseMonthlyPayment, extraMonthly, investReturnRate]);

    // 차트에 표시할 데이터 (매 3개월마다 표시하여 성능 조절)
    const chartData = useMemo(() => {
        return schedule.filter((_, i) => i % 3 === 0 || i === schedule.length - 1);
    }, [schedule]);

    const savedMonths = normalEndMonth - fastEndMonth;
    const savedInterest = normalTotalInterest - fastTotalInterest;

    return (
        <div className="space-y-6">
            {/* === 1. 가처분 소득 요약 카드 === */}
            {forecast && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">💰 월 가처분 소득 (최근 {forecast.basedOnMonths}개월 기준)</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/10">
                            <p className="text-xs text-gray-500 dark:text-gray-400">평균 수입</p>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">₩{forecast.avgMonthlyIncome.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/10">
                            <p className="text-xs text-gray-500 dark:text-gray-400">평균 지출</p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-400">₩{forecast.avgMonthlyExpense.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/10">
                            <p className="text-xs text-gray-500 dark:text-gray-400">대출 납입</p>
                            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">₩{forecast.totalLoanPayment.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/10 ring-2 ring-green-200 dark:ring-green-800">
                            <p className="text-xs font-semibold text-green-700 dark:text-green-300">🔑 활용 가능한 돈</p>
                            <p className="text-xl font-extrabold text-green-600 dark:text-green-400">₩{forecast.freeRouteSpace.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* === 2. 조기상환 슬라이더 === */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">🧮 조기상환 시뮬레이터</h3>
                </div>
                <div className="p-5 space-y-4">
                    {/* 슬라이더 */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">매월 추가 상환 금액</label>
                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">₩{extraMonthly.toLocaleString()}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={maxSlider}
                            step={10000}
                            value={extraMonthly}
                            onChange={e => setExtraMonthly(Number(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>₩0</span>
                            <span>₩{maxSlider.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* KPI 카드 4개 */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
                            <p className="text-xs text-gray-500">기본 월 납입금</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">₩{baseMonthlyPayment.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-indigo-50 p-4 dark:bg-indigo-900/10">
                            <p className="text-xs text-gray-500">추가 시 월 납입</p>
                            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">₩{(baseMonthlyPayment + extraMonthly).toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/10">
                            <p className="text-xs text-gray-500">🗓️ 단축 기간</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">{savedMonths}개월 ({(savedMonths / 12).toFixed(1)}년)</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/10">
                            <p className="text-xs text-gray-500">💸 절약 이자</p>
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">₩{savedInterest.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* 완납 예상일 비교 */}
                    <div className="flex items-center justify-center gap-8 text-center py-2">
                        <div>
                            <p className="text-xs text-gray-500">기본 상환 완료</p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{schedule[normalEndMonth - 1]?.label || '—'}</p>
                            <p className="text-xs text-gray-400">{normalEndMonth}개월</p>
                        </div>
                        <div className="text-2xl text-green-500">→</div>
                        <div>
                            <p className="text-xs text-green-600 dark:text-green-400 font-semibold">조기 상환 완료</p>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">{schedule[fastEndMonth - 1]?.label || '—'}</p>
                            <p className="text-xs text-green-500">{fastEndMonth}개월</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 3. 원금(잔액) 소진 비교 차트 === */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">📉 원금 소진 비교 (기본 vs 조기상환)</h3>
                </div>
                <div className="p-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: any) => `₩${Number(v || 0).toLocaleString()}`} />
                            <Legend />
                            <Line type="monotone" dataKey="balanceNormal" stroke="#9ca3af" strokeWidth={2} name="기본 상환" dot={false} />
                            <Line type="monotone" dataKey="balanceFast" stroke="#6366f1" strokeWidth={3} name="조기 상환" dot={false} />
                            <ReferenceLine y={0} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '완납', fill: '#22c55e', fontSize: 12 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* === 4. 기회비용 비교 (상환 vs 투자) === */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">⚖️ 기회비용: 상환 vs 투자</h3>
                </div>
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">투자 기대수익률</label>
                        <input
                            type="range" min={1} max={20} step={0.5} value={investReturnRate}
                            onChange={e => setInvestReturnRate(Number(e.target.value))}
                            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-emerald-500"
                        />
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 w-12 text-right">{investReturnRate}%</span>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        대출 이율 <strong>{(annualRate * 100).toFixed(2)}%</strong> vs 투자 기대수익률 <strong>{investReturnRate}%</strong> — {normalEndMonth}개월 동안 매월 ₩{extraMonthly.toLocaleString()}을 비교합니다.
                    </p>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* 시나리오 A: 빨리 갚고 나중에 투자 */}
                        <div className={`rounded-xl p-5 border-2 ${opportunityCost.betterOption === 'A' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-600' : 'border-gray-200 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-700'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {opportunityCost.betterOption === 'A' && <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold dark:bg-emerald-800 dark:text-emerald-200">유리</span>}
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">A. 대출 먼저 갚기</p>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{fastEndMonth}개월에 완납 → 나머지 {normalEndMonth - fastEndMonth}개월 투자</p>
                            <p className="text-xl font-extrabold mt-2 text-gray-900 dark:text-white">₩{opportunityCost.netWorthA.toLocaleString()}</p>
                            <p className="text-xs text-gray-400">완납 후 투자 자산</p>
                        </div>

                        {/* 시나리오 B: 투자하면서 천천히 갚기 */}
                        <div className={`rounded-xl p-5 border-2 ${opportunityCost.betterOption === 'B' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-600' : 'border-gray-200 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-700'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {opportunityCost.betterOption === 'B' && <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold dark:bg-emerald-800 dark:text-emerald-200">유리</span>}
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">B. 투자하면서 갚기</p>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{normalEndMonth}개월 동안 매월 ₩{extraMonthly.toLocaleString()} 투자</p>
                            <p className="text-xl font-extrabold mt-2 text-gray-900 dark:text-white">₩{opportunityCost.netWorthB.toLocaleString()}</p>
                            <p className="text-xs text-gray-400">투자 자산 (부채는 만기 완납)</p>
                        </div>
                    </div>

                    <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                        ※ 투자 수익률은 보장되지 않습니다. 참고용 시뮬레이션이며, 실제 투자에는 원금 손실 가능성이 있습니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
