import { RangeKey, INTERVAL_MS, limitFor } from './chartUtils';
import { Candle, Interval, Point, fetchMetric, fetchPremium } from '../services/market';

export type Indicator = 'oi' | 'lsr' | 'top-lsr' | 'taker' | 'funding' | 'premium-upbit' | 'premium-bithumb' | 'volume';

const FUNDING_MS = 8 * 3600_000;

/** 지표 시계열 로드. 가격 캔들(volume용)을 재사용한다. */
export const loadIndicator = async (
  indicator: Indicator, coin: string, interval: Interval, range: RangeKey, candles: Candle[],
): Promise<Point[]> => {
  const limit = limitFor(range, interval);
  switch (indicator) {
    case 'volume':
      return candles.map(k => ({ t: k.t, v: k.v }));
    case 'funding': {
      const n = range === 'ALL' ? 1000 : Math.ceil((limit * INTERVAL_MS[interval]) / FUNDING_MS);
      return fetchMetric('funding', `${coin}USDT`, interval, n);
    }
    case 'premium-upbit':
      return fetchPremium(coin, 'upbit', interval, limit);
    case 'premium-bithumb':
      return fetchPremium(coin, 'bithumb', interval, limit);
    default:
      return fetchMetric(indicator, `${coin}USDT`, interval, limit);
  }
};

export const indicatorSeriesType = (i: Indicator): 'line' | 'column' | 'area' =>
  i === 'volume' || i === 'funding' ? 'column' : i === 'oi' ? 'area' : 'line';
