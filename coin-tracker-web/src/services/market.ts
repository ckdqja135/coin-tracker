import axios from 'axios';

// CRA proxy(package.json "proxy")를 통해 Node 서버(/api/market)로 전달된다.
const client = axios.create({ baseURL: '/api/market', timeout: 20000 });

export type Interval = '1m' | '5m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type KlineSource = 'binance' | 'binance-futures' | 'upbit' | 'bithumb' | 'yahoo';
export type MetricType = 'oi' | 'lsr' | 'top-lsr' | 'taker' | 'funding';
export type LongShortExchange = 'binance' | 'bybit' | 'okx';

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }
export interface Point { t: number; v: number; }
export interface LongShortPoint { t: number; long: number; short: number; ratio: number; }

export interface CoinSnapshot {
  coin: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number | null;
  fundingRate: number | null;
  nextFundingTime: number | null;
  longShortRatio: number | null;
  krwPrice: { upbit: number | null; bithumb: number | null };
  usdKrw: number | null;
  premium: { upbit: number | null; bithumb: number | null };
}

export const fetchKlines = async (source: KlineSource, symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
  const { data } = await client.get('/klines', { params: { source, symbol, interval, limit } });
  return data.data;
};

export const fetchMetric = async (type: MetricType, symbol: string, interval: Interval, limit: number): Promise<Point[]> => {
  const { data } = await client.get('/metric', { params: { type, symbol, interval, limit } });
  return data.data;
};

export const fetchPremium = async (coin: string, exchange: 'upbit' | 'bithumb', interval: Interval, limit: number): Promise<Point[]> => {
  const { data } = await client.get('/premium', { params: { coin, exchange, interval, limit } });
  return data.data;
};

export const fetchLongShort = async (
  exchange: LongShortExchange, coin: string, period: string, limit: number,
): Promise<{ periods: string[]; data: LongShortPoint[] }> => {
  const { data } = await client.get('/longshort', { params: { exchange, coin, period, limit } });
  return { periods: data.periods, data: data.data };
};

export const fetchSnapshot = async (coin: string): Promise<CoinSnapshot> => {
  const { data } = await client.get('/snapshot', { params: { coin } });
  return data;
};
