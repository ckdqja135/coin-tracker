import { Interval, Point, SeriesKind, fetchKlines, fetchSeries } from '../services/market';
import { findAsset } from './assets';

/**
 * 비교 카드 / 비교 차트에서 쓰는 시계열 카탈로그
 * 가격(바이낸스·야후)과 보조 지표(거래소별 OI, 공포탐욕, 해시레이트, 난이도)를 같은 형태로 다룬다.
 */
export type CardRange = '1D' | '1W' | '1M' | '1Y' | 'ALL';
export type CatalogGroup = 'crypto' | 'derivatives' | 'indices' | 'commodity' | 'mining' | 'trending';

export interface CatalogItem {
  id: string;
  label: string;
  short: string;
  group: CatalogGroup;
  /** 지원하는 기간 (느린 지표는 1W 이상만) */
  ranges: CardRange[];
  load: (interval: Interval, limit: number) => Promise<Point[]>;
}

const FAST: CardRange[] = ['1D', '1W', '1M', '1Y'];
const SLOW: CardRange[] = ['1W', '1M', '1Y'];

export const RANGE_INTERVALS: Record<CardRange, Interval[]> = {
  '1D': ['5m', '30m', '1h'],
  '1W': ['1h', '4h', '1d'],
  '1M': ['4h', '1d'],
  '1Y': ['1d', '1w'],
  'ALL': ['1w', '1M'],
};

const DAY = 86_400_000;
export const RANGE_MS: Record<CardRange, number> = { '1D': DAY, '1W': 7 * DAY, '1M': 30 * DAY, '1Y': 365 * DAY, 'ALL': 3000 * DAY };
const IV_MS: Record<Interval, number> = {
  '1m': 60_000, '5m': 300_000, '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000, '1d': DAY, '1w': 7 * DAY, '1M': 30 * DAY,
};

export const cardLimit = (range: CardRange, interval: Interval) => Math.min(1000, Math.ceil(RANGE_MS[range] / IV_MS[interval]));

/** 느린 지표는 일 단위 이상으로만 조회한다 */
export const intervalsFor = (item: CatalogItem, range: CardRange): Interval[] =>
  item.ranges === SLOW ? (range === '1Y' || range === 'ALL' ? ['1d', '1w'] : ['1d']) : RANGE_INTERVALS[range];

const price = (assetId: string): CatalogItem['load'] => async (interval, limit) => {
  const a = findAsset(assetId)!;
  const k = await fetchKlines(a.source, a.symbol, interval, limit);
  return k.map(c => ({ t: c.t, v: c.c }));
};

const series = (kind: SeriesKind, coin: string): CatalogItem['load'] => (interval, limit) => fetchSeries(kind, coin, interval, limit);

const priceItem = (assetId: string, group: CatalogGroup, label?: string): CatalogItem => {
  const a = findAsset(assetId)!;
  return { id: assetId, label: label ?? `${a.name} (${a.short})`, short: a.short, group, ranges: FAST, load: price(assetId) };
};

const oiItems = (coin: string): CatalogItem[] => [
  { id: `${coin}-OI-BINANCE`, label: `${coin}_Open Interest_Binance`, short: 'OI Binance', group: 'derivatives', ranges: FAST, load: series('oi-binance', coin) },
  { id: `${coin}-OI-BYBIT`, label: `${coin}_Open Interest_Bybit`, short: 'OI Bybit', group: 'derivatives', ranges: FAST, load: series('oi-bybit', coin) },
  { id: `${coin}-OI-OKX`, label: `${coin}_Open Interest_OKX`, short: 'OI OKX', group: 'derivatives', ranges: FAST, load: series('oi-okx', coin) },
];

const MACRO: CatalogItem[] = [
  priceItem('DXY', 'indices', 'US Dollar Index'),
  priceItem('NDX', 'indices', 'Nasdaq 100'),
  priceItem('SPX', 'indices', 'S&P 500'),
  priceItem('GOLD', 'commodity', 'Gold'),
  priceItem('SILVER', 'commodity', 'Silver'),
  priceItem('BRENT', 'commodity', 'Brent Oil'),
  priceItem('OIL', 'commodity', 'Crude Oil WTI'),
];

/** BTC / ETH 페이지 비교 대상 */
export const vsTargets = (base: 'BTC' | 'ETH'): CatalogItem[] => [
  priceItem(base === 'BTC' ? 'ETH' : 'BTC', 'crypto'),
  ...oiItems(base),
  ...MACRO,
  ...(base === 'BTC'
    ? [
      { id: 'DIFFICULTY', label: 'Difficulty', short: 'Difficulty', group: 'mining' as const, ranges: SLOW, load: series('difficulty', 'BTC') },
      { id: 'HASHRATE', label: 'Hash Rate', short: 'Hash Rate', group: 'mining' as const, ranges: SLOW, load: series('hashrate', 'BTC') },
      { id: 'FNG', label: 'Crypto Fear & Greed Index', short: 'Fear & Greed', group: 'trending' as const, ranges: SLOW, load: series('fng', 'BTC') },
    ]
    : []),
];

export const basePrice = (base: 'BTC' | 'ETH'): CatalogItem => priceItem(base, 'crypto');

/** 마켓 페이지 */
export const marketItems = (): CatalogItem[] => [
  ...['BTC', 'ETH', 'XRP', 'SOL', 'BNB', 'DOGE'].map(id => priceItem(id, 'crypto')),
  ...MACRO,
];

/** 비교 차트(Compare VS) 선택 목록 */
export const compareItems = (): CatalogItem[] => [
  ...['BTC', 'ETH', 'XRP', 'SOL', 'BNB', 'DOGE'].map(id => priceItem(id, 'crypto')),
  ...oiItems('BTC'),
  ...oiItems('ETH'),
  ...MACRO,
];
