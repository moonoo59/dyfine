import { useState, useEffect } from 'react';

interface ExchangeRates {
    USD: number;
    EUR: number;
    JPY: number; // 100 JPY
}

export function ExchangeRateWidget() {
    const [rates, setRates] = useState<ExchangeRates | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                // Free, no-auth exchange rate API (base: USD)
                const res = await fetch('https://open.er-api.com/v6/latest/USD');
                if (!res.ok) throw new Error('API Error');
                const data = await res.json();

                const krwPerUsd = data.rates.KRW;
                const krwPerEur = krwPerUsd / data.rates.EUR;
                const krwPer100Jpy = (krwPerUsd / data.rates.JPY) * 100;

                setRates({
                    USD: krwPerUsd,
                    EUR: krwPerEur,
                    JPY: krwPer100Jpy,
                });
            } catch (err) {
                console.error('Failed to fetch exchange rates', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchRates();
    }, []);

    return (
        <div className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">실시간 환율 정보</p>
                <div className="mt-1 flex items-baseline space-x-2">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                        KRW 기준 (매매기준율)
                    </p>
                </div>
            </div>

            <div className="mt-4 flex-1 space-y-4">
                {loading && <div className="text-sm text-gray-500">환율 정보 로딩 중...</div>}
                {error && <div className="text-sm text-red-500">환율을 불러올 수 없습니다.</div>}
                {!loading && !error && rates && (
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-zinc-900/50">
                            <div className="flex items-center space-x-3">
                                <span className="text-xl">🇺🇸</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">USD (미국)</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                ₩{rates.USD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-zinc-900/50">
                            <div className="flex items-center space-x-3">
                                <span className="text-xl">🇪🇺</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">EUR (유럽)</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                ₩{rates.EUR.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-zinc-900/50">
                            <div className="flex items-center space-x-3">
                                <span className="text-xl">🇯🇵</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">JPY (일본 100엔)</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                ₩{rates.JPY.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                )}
            </div>
            {!loading && !error && (
                <div className="mt-2 text-right">
                    <span className="text-[10px] text-gray-400">데이터 제공: open.er-api.com</span>
                </div>
            )}
        </div>
    );
}
