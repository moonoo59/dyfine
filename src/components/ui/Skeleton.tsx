/**
 * Skeleton UI 컴포넌트
 * - "로딩 중..." 텍스트를 대체하는 펄스 애니메이션 뼈대 UI
 * - 다크모드 지원
 */

/** 기본 Skeleton 블록 */
export function SkeletonBlock({ className = '' }: { className?: string }) {
    return (
        <div className={`animate-pulse rounded bg-gray-200 dark:bg-zinc-800 ${className}`} />
    );
}

/** KPI 카드 스켈레톤 */
export function SkeletonCard() {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <SkeletonBlock className="h-3 w-16 mb-3" />
            <SkeletonBlock className="h-7 w-32" />
        </div>
    );
}

/** 테이블 행 스켈레톤 */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
    return (
        <tr>
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <SkeletonBlock className="h-4 w-full" />
                </td>
            ))}
        </tr>
    );
}

/** 목록 아이템 스켈레톤 */
export function SkeletonListItem() {
    return (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
            <div className="space-y-2 flex-1">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-3 w-48" />
            </div>
            <SkeletonBlock className="h-5 w-20" />
        </div>
    );
}

/** 전체 페이지 로딩 스켈레톤 (KPI + 리스트) */
export function SkeletonPage({ cardCount = 4, rowCount = 5 }: { cardCount?: number; rowCount?: number }) {
    return (
        <div className="space-y-6">
            {/* KPI 카드 영역 */}
            <div className={`grid grid-cols-2 gap-4 sm:grid-cols-${Math.min(cardCount, 4)}`}>
                {Array.from({ length: cardCount }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>
            {/* 목록 영역 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                {Array.from({ length: rowCount }).map((_, i) => (
                    <SkeletonListItem key={i} />
                ))}
            </div>
        </div>
    );
}
