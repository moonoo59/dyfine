import { useMemo } from 'react';

/**
 * 월 선택기 공통 컴포넌트
 * - 좌우 화살표로 월 이동
 * - 가운데 클릭 시 현재 월로 복귀
 * - BudgetsPage, ClosingPage 등 여러 곳에서 재사용
 *
 * @param year    현재 선택된 연도
 * @param month   현재 선택된 월 (1~12)
 * @param onChange 연도/월 변경 콜백
 */
interface MonthPickerProps {
    year: number;
    month: number;
    onChange: (year: number, month: number) => void;
}

export default function MonthPicker({ year, month, onChange }: MonthPickerProps) {
    // 현재 월인지 확인 (현재 월 강조 표시용)
    const now = useMemo(() => new Date(), []);
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

    // 이전 월 이동
    const goToPrev = () => {
        if (month === 1) onChange(year - 1, 12);
        else onChange(year, month - 1);
    };

    // 다음 월 이동
    const goToNext = () => {
        if (month === 12) onChange(year + 1, 1);
        else onChange(year, month + 1);
    };

    // 현재 월로 복귀
    const goToCurrent = () => {
        onChange(now.getFullYear(), now.getMonth() + 1);
    };

    return (
        <div className="flex items-center justify-center space-x-4">
            {/* 이전 월 버튼 */}
            <button
                onClick={goToPrev}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-gray-400 transition-colors"
                aria-label="이전 월"
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
            </button>

            {/* 현재 선택 월 표시 (클릭 시 현재 월로 복귀) */}
            <button
                onClick={goToCurrent}
                className={`text-lg font-semibold transition-colors ${isCurrentMonth
                        ? 'text-gray-900 dark:text-white'
                        : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-500'
                    }`}
            >
                {year}년 {month}월
            </button>

            {/* 다음 월 버튼 */}
            <button
                onClick={goToNext}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-gray-400 transition-colors"
                aria-label="다음 월"
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
            </button>
        </div>
    );
}
