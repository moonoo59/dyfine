import { useState } from 'react';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useCategories } from '@/hooks/queries/useCategories';

/**
 * 공통 필터바 컴포넌트
 * - Transactions, Reports 등 여러 페이지에서 재사용
 * - 기간(시작/종료), 계좌, 카테고리, 키워드 필터 제공
 * - 필터 변경 시 부모 컴포넌트에 콜백으로 전달
 */
export interface FilterValues {
    /** 시작일 (YYYY-MM-DD) */
    startDate: string;
    /** 종료일 (YYYY-MM-DD) */
    endDate: string;
    /** 선택된 계좌 ID (0 = 전체) */
    accountId: number;
    /** 선택된 카테고리 ID (0 = 전체) */
    categoryId: number;
    /** 검색 키워드 (메모) */
    keyword: string;
    /** 거래 유형 필터 ('' = 전체) */
    entryType: string;
    /** 소스 필터 ('' = 전체) */
    source: string;
}

interface FilterBarProps {
    /** 현재 필터 값 */
    values: FilterValues;
    /** 필터 변경 콜백 */
    onChange: (values: FilterValues) => void;
    /** 표시할 필터 항목 선택 (기본: 전체) */
    show?: {
        date?: boolean;
        account?: boolean;
        category?: boolean;
        keyword?: boolean;
        entryType?: boolean;
        source?: boolean;
    };
}

/** 기본 필터 값 생성 (당월 1일 ~ 오늘) */
export function getDefaultFilterValues(): FilterValues {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        accountId: 0,
        categoryId: 0,
        keyword: '',
        entryType: '',
        source: '',
    };
}

export default function FilterBar({ values, onChange, show }: FilterBarProps) {
    // 기본값: 모든 필터 표시
    const showFields = {
        date: show?.date ?? true,
        account: show?.account ?? true,
        category: show?.category ?? true,
        keyword: show?.keyword ?? true,
        entryType: show?.entryType ?? false,
        source: show?.source ?? false,
    };

    // 전역 캐시에서 계좌/카테고리 가져오기
    const { data: accountsData } = useAccounts();
    const { data: categoriesData } = useCategories();
    const accounts = accountsData || [];
    const categories = categoriesData || [];

    // 필터 확장/축소 토글
    const [expanded, setExpanded] = useState(false);

    // 개별 필드 변경 핸들러
    const update = (field: keyof FilterValues, value: string | number) => {
        onChange({ ...values, [field]: value });
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {/* 기본 필터 (항상 표시) */}
            <div className="flex flex-wrap items-center gap-3 p-4">
                {/* 기간 필터 */}
                {showFields.date && (
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={values.startDate}
                            onChange={e => update('startDate', e.target.value)}
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                        <span className="text-gray-400 text-sm">~</span>
                        <input
                            type="date"
                            value={values.endDate}
                            onChange={e => update('endDate', e.target.value)}
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </div>
                )}

                {/* 계좌 필터 */}
                {showFields.account && (
                    <select
                        value={values.accountId}
                        onChange={e => update('accountId', Number(e.target.value))}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    >
                        <option value={0}>전체 계좌</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                )}

                {/* 카테고리 필터 */}
                {showFields.category && (
                    <select
                        value={values.categoryId}
                        onChange={e => update('categoryId', Number(e.target.value))}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    >
                        <option value={0}>전체 카테고리</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                )}

                {/* 키워드 검색 */}
                {showFields.keyword && (
                    <input
                        type="text"
                        value={values.keyword}
                        onChange={e => update('keyword', e.target.value)}
                        placeholder="키워드 검색..."
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                )}

                {/* 확장 토글 */}
                {(showFields.entryType || showFields.source) && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                        {expanded ? '접기 ▲' : '상세 ▼'}
                    </button>
                )}
            </div>

            {/* 확장 필터 (토글) */}
            {expanded && (
                <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 p-4 dark:border-zinc-800">
                    {/* 거래 유형 필터 */}
                    {showFields.entryType && (
                        <select
                            value={values.entryType}
                            onChange={e => update('entryType', e.target.value)}
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        >
                            <option value="">전체 유형</option>
                            <option value="income">수입</option>
                            <option value="expense">지출</option>
                            <option value="transfer">이체</option>
                            <option value="adjustment">조정</option>
                        </select>
                    )}

                    {/* 소스 필터 */}
                    {showFields.source && (
                        <select
                            value={values.source}
                            onChange={e => update('source', e.target.value)}
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        >
                            <option value="">전체 소스</option>
                            <option value="manual">수동 입력</option>
                            <option value="import">Import</option>
                            <option value="auto_transfer">자동이체</option>
                            <option value="loan">대출</option>
                            <option value="system">시스템</option>
                        </select>
                    )}
                </div>
            )}
        </div>
    );
}
