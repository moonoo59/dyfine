interface RecentTransactionsListProps {
    transactions: any[];
}

export function RecentTransactionsList({ transactions }: RecentTransactionsListProps) {
    if (transactions.length === 0) {
        return <li className="p-6 text-center text-sm text-gray-500">최근 거래 내역이 없습니다.</li>;
    }

    return (
        <>
            {transactions.map(trx => {
                // 간략한 금액 합산 (절대값)
                const amount = trx.lines.reduce((s: number, l: any) => s + Math.abs(l.amount), 0) / (trx.entry_type === 'transfer' ? 2 : 1);
                const isInc = trx.entry_type === 'income';
                const isExp = trx.entry_type === 'expense';

                return (
                    <li key={trx.id} className="flex px-6 py-4 items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                        <div className="flex flex-col">
                            <span className="font-medium text-gray-900 dark:text-white">{trx.memo || trx.category?.name || '미분류'}</span>
                            <span className="text-xs text-gray-500">{new Date(trx.occurred_at).toLocaleDateString()}</span>
                        </div>
                        <span className={`font-semibold ${isInc ? 'text-blue-600' : isExp ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                            {isInc ? '+' : isExp ? '-' : ''}{amount.toLocaleString()} 원
                        </span>
                    </li>
                );
            })}
        </>
    );
}
