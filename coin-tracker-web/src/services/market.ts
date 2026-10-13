import axios from 'axios';

// CRA proxy(package.json "proxy")를 통해 Node 서버(/api/market)로 전달된다.
const client = axios.create({ baseURL: '/api/market', timeout: 20000 });

export type Interval = '1m' | '5m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type KlineSource = 'binance' | 'binance-futures' | 'upbit' | 'bithumb' | 'coinone' | 'korbit' | 'gateio' | 'yahoo';

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }
export interface Point { t: number; v: number; }

export const fetchKlines = async (source: KlineSource, symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
  const { data } = await client.get('/klines', { params: { source, symbol, interval, limit } });
  return data.data;
};

export type TickerExchange = 'upbit' | 'coinone' | 'bithumb' | 'korbit' | 'gateio' | 'binance';
export interface Ticker { price: number; change24h: number | null; high: number | null; low: number | null; }
export interface ExchangeTickers {
  exchange: TickerExchange;
  currency: 'KRW' | 'USD';
  time: number;
  usdKrw: number | null;
  data: Record<string, Ticker>;
}
export interface CoinListItem { symbol: string; en: string; ko: string | null; }
export interface OverviewItem { id: string; name: string; value: number; change: number | null; changePct: number | null; }
export interface CoinInfo {
  symbol: string; name: string; image: string | null; price: number; change24h: number | null;
  high24h: number | null; low24h: number | null; marketCap: number | null;
}

export const fetchTickers = async (exchange: TickerExchange, coins: string[]): Promise<ExchangeTickers> => {
  const { data } = await client.get('/tickers', { params: { exchange, coins: coins.join(',') } });
  return data;
};

export const fetchCoinList = async (): Promise<CoinListItem[]> => (await client.get('/coins')).data;

export const fetchOverview = async (): Promise<OverviewItem[]> => (await client.get('/overview')).data;

export const fetchCoinInfo = async (symbols: string[]): Promise<CoinInfo[]> =>
  (await client.get('/coininfo', { params: { symbols: symbols.join(',') } })).data;

export type SeriesKind = 'oi-binance' | 'oi-bybit' | 'oi-okx' | 'fng' | 'hashrate' | 'difficulty' | 'btc-dominance';

export const fetchSeries = async (kind: SeriesKind, coin: string, interval: Interval, limit: number): Promise<Point[]> => {
  const { data } = await client.get('/series', { params: { kind, coin, interval, limit } });
  return data.data;
};

/** since(ms) 이후 캔들을 모두 받는다 (CIM 백필용) */
export const fetchKlinesSince = async (source: KlineSource, symbol: string, interval: Interval, since: number): Promise<Candle[]> => {
  const { data } = await client.get('/klines', { params: { source, symbol, interval, since } });
  return data.data;
};

/** 롱/숏: 서버가 모아 둔 거래소별 테이커 매수/매도 합계와 최근 대형 체결 */
export type FlowExchange = 'binance' | 'bybit' | 'okx' | 'bitget';
export interface FlowTrade { exchange: FlowExchange; side: 'buy' | 'sell'; price: number; qty: number; usd: number; time: number; }
export interface FlowSnapshot {
  coin: string;
  now: number;
  since: Record<FlowExchange, number | null>;
  windows: Record<string, Record<FlowExchange, { buy: number; sell: number }>>;
  bigTrades: FlowTrade[];
}

export const fetchFlow = async (coin: string): Promise<FlowSnapshot> => (await client.get('/flow', { params: { coin } })).data;

/** 거래소 공개 계정 롱/숏 비율 (가장 최근 값) */
export interface AccountRatio { t: number; long: number; short: number; ratio: number; }

export const fetchAccountRatio = async (exchange: FlowExchange, coin: string): Promise<AccountRatio | null> => {
  const { data } = await client.get('/longshort', { params: { exchange, coin, period: '5m', limit: 1 } });
  return data.data?.[data.data.length - 1] ?? null;
};

/** 원/달러 환율, 테더 김프, 공포·탐욕 지수 */
export interface KoreaIndicators {
  usdKrw: number | null;
  usdtKrw: number | null;
  usdtPremium: number | null;
  fng: { value: number; label: string; prev: number | null } | null;
}

export const fetchIndicators = async (): Promise<KoreaIndicators> => (await client.get('/indicators')).data;
