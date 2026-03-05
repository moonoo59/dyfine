/**
 * 금융 API 연동 유틸리티 (Yahoo Finance 등 활용)
 */

export async function fetchTickerPrice(ticker: string): Promise<number | null> {
    if (!ticker) return null;

    try {
        const cleanTicker = ticker.trim().toUpperCase();

        // 브라우저에서 직접 야후 파이낸스 호출 시 CORS 방지를 위해 corsproxy.io 등 활용 (또는 서버리스 함수 권장)
        // 데모 환경을 위해 corsproxy.io를 이용한 쿼리 예시
        const url = `https://corsproxy.io/?https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.warn(`Failed to fetch price for ${cleanTicker}: ${response.status}`);
            return null;
        }

        const data = await response.json();

        // 응답 구조에서 현재가 추출
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

        if (typeof price === 'number') {
            return price;
        }

        return null;
    } catch (e) {
        console.error('Error fetching ticker price:', e);
        return null;
    }
}
