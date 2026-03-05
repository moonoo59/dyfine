import { useState } from 'react';
import { useHoldings, useRecordTrade, useUpdateSecurityPrices } from '@/hooks/queries/useInvestments';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useCategories } from '@/hooks/queries/useCategories';
import { toast } from 'react-hot-toast';
import CurrencyInput from '@/components/ui/CurrencyInput';

import OverviewTab from '@/components/investments/OverviewTab';
import ThemeTab from '@/components/investments/ThemeTab';
import AccountTab from '@/components/investments/AccountTab';
import TargetTab from '@/components/investments/TargetTab';

/**
 * 투자 관리 탭 구조 통합 페이지 (v3.0)
 */
export default function InvestmentsPage() {
    const { data: holdings, isLoading: isHoldingsLoading } = useHoldings();
    const { data: accountsData } = useAccounts();
    const { data: categoriesData } = useCategories();
    const tradeMutation = useRecordTrade();
    const updatePricesMutation = useUpdateSecurityPrices();

    const accounts = accountsData || [];
    const categories = categoriesData || [];

    // 모달 상태
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

    // 거래 입력 상태
    const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
    const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
    const [ticker, setTicker] = useState('');
    const [securityName, setSecurityName] = useState('');
    const [market] = useState('KOSPI');
    const [quantity, setQuantity] = useState(0);
    const [price, setPrice] = useState(0);
    const [fee, setFee] = useState(0);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');

    // 가격 갱신 상태 관리
    const [updatedPrices, setUpdatedPrices] = useState<Record<number, number>>({});

    const handleOpenPriceModal = () => {
        if (!holdings) return;
        const initialPrices: Record<number, number> = {};
        holdings.forEach(h => {
            initialPrices[h.security.id] = h.last_price;
        });
        setUpdatedPrices(initialPrices);
        setIsPriceModalOpen(true);
    };

    // ============================================
    // 탭 관리 상태
    // ============================================
    const [activeTab, setActiveTab] = useState<'overview' | 'theme' | 'account' | 'target'>('overview');

    const handleTradeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAccountId || !ticker || !securityName || quantity <= 0 || price <= 0) {
            toast.error('필수 정보를 입력해주세요.');
            return;
        }

        try {
            await tradeMutation.mutateAsync({
                accountId: Number(selectedAccountId),
                ticker,
                name: securityName,
                market,
                tradeType,
                quantity,
                price,
                fee,
                categoryId: selectedCategoryId ? Number(selectedCategoryId) : undefined
            });
            setIsTradeModalOpen(false);
            // 초기화
            setTicker('');
            setSecurityName('');
            setQuantity(0);
            setPrice(0);
            setFee(0);
        } catch (error: any) {
            toast.error('거래 기록 실패: ' + error.message);
        }
    };

    const handlePriceUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const prices = Object.entries(updatedPrices).map(([securityId, priceStr]) => ({
            security_id: Number(securityId),
            price: Number(priceStr)
        }));

        try {
            await updatePricesMutation.mutateAsync(prices);
            setIsPriceModalOpen(false);
        } catch (error: any) {
            toast.error('가격 갱신 실패: ' + error.message);
        }
    };

    if (isHoldingsLoading) return <div className="p-8 text-center text-zinc-500">투자 데이터를 불러오는 중...</div>;

    return (
        <div className="space-y-6">
            {/* 상단 헤더 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">투자 관리</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">보유 자산 현황 및 수익률을 실시간으로 확인합니다.</p>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={handleOpenPriceModal}
                        className="rounded-lg bg-green-600 px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium text-white shadow-sm hover:bg-green-700 whitespace-nowrap"
                    >
                        현재가 갱신
                    </button>
                    <button
                        onClick={() => { setTradeType('buy'); setIsTradeModalOpen(true); }}
                        className="rounded-lg bg-indigo-600 px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium text-white shadow-sm hover:bg-indigo-700 whitespace-nowrap"
                    >
                        매수/매도 기록
                    </button>
                </div>
            </div>

            {/* 탭 헤더 */}
            <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-zinc-800 space-x-6 px-1">
                {[
                    { id: 'overview', label: '📊 전체 현황' },
                    { id: 'theme', label: '🚀 테마별 투자' },
                    { id: 'account', label: '🏦 계좌별 수익률' },
                    { id: 'target', label: '⚖️ 목표 비중 리밸런싱' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'overview' | 'theme' | 'account' | 'target')}
                        className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${activeTab === tab.id
                            ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-zinc-700 dark:hover:text-gray-300'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 탭 컨텐츠 렌더링 */}
            <div className="mt-4">
                {activeTab === 'overview' && <OverviewTab holdings={holdings || []} />}
                {activeTab === 'theme' && <ThemeTab holdings={holdings || []} />}
                {activeTab === 'account' && <AccountTab />}
                {activeTab === 'target' && <TargetTab />}
            </div>

            {/* 매매 입력 모달 */}
            {isTradeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <div className="mb-6 flex space-x-2">
                            <button
                                onClick={() => setTradeType('buy')}
                                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${tradeType === 'buy' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800'}`}
                            >
                                매수
                            </button>
                            <button
                                onClick={() => setTradeType('sell')}
                                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${tradeType === 'sell' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800'}`}
                            >
                                매도
                            </button>
                        </div>

                        <form onSubmit={handleTradeSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">티커/심볼</label>
                                    <input
                                        type="text"
                                        value={ticker}
                                        onChange={e => setTicker(e.target.value.toUpperCase())}
                                        placeholder="예: 005930"
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">종목명</label>
                                    <input
                                        type="text"
                                        value={securityName}
                                        onChange={e => setSecurityName(e.target.value)}
                                        placeholder="예: 삼성전자"
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">거래 수량</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={quantity}
                                        onChange={e => setQuantity(Number(e.target.value))}
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">거래 단가</label>
                                    <CurrencyInput
                                        value={price}
                                        onChange={setPrice}
                                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">연결 계좌</label>
                                    <select
                                        value={selectedAccountId}
                                        onChange={e => setSelectedAccountId(Number(e.target.value))}
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    >
                                        <option value="">계좌 선택</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">카테고리 (선택)</label>
                                    <select
                                        value={selectedCategoryId}
                                        onChange={e => setSelectedCategoryId(Number(e.target.value))}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    >
                                        <option value="">선택 안 함</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">수수료/세금 (선택)</label>
                                <CurrencyInput
                                    value={fee}
                                    onChange={setFee}
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 pr-10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsTradeModalOpen(false)}
                                    className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-zinc-700 dark:text-gray-300"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={tradeMutation.isPending}
                                    className={`rounded-md px-4 py-2 text-sm text-white transition-colors ${tradeType === 'buy' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:opacity-50`}
                                >
                                    {tradeMutation.isPending ? '저장 중...' : `${tradeType === 'buy' ? '매수' : '매도'} 기록`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* 현재가 일괄 갱신 모달 */}
            {isPriceModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">현재가 일괄 갱신</h2>
                        <form onSubmit={handlePriceUpdateSubmit} className="space-y-4">
                            <div className="max-h-64 overflow-y-auto pr-2 space-y-4">
                                {holdings?.map(h => (
                                    <div key={h.security.id} className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{h.security.name}</p>
                                            <p className="text-xs text-gray-500">{h.security.ticker} ({h.security.market})</p>
                                        </div>
                                        <div className="w-1/2">
                                            <CurrencyInput
                                                value={updatedPrices[h.security.id] || 0}
                                                onChange={(val) => setUpdatedPrices(prev => ({ ...prev, [h.security.id]: val }))}
                                                className="block w-full rounded-md border border-gray-300 py-1 pr-8 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsPriceModalOpen(false)}
                                    className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-zinc-700 dark:text-gray-300"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatePricesMutation.isPending}
                                    className="rounded-md bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600 disabled:opacity-50"
                                >
                                    {updatePricesMutation.isPending ? '저장 중...' : '저장'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
