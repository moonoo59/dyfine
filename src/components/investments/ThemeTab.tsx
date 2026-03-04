export default function ThemeTab({ holdings: _holdings }: { holdings: any[] }) {
    return (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500 dark:border-zinc-700 dark:text-gray-400">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">🚀 테마별 투자 현황</h3>
            <p className="mt-2 text-sm">테마별/배당주별 투자 비중 분석 기능이 곧 제공됩니다.</p>
        </div>
    );
}
