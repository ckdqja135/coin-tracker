import { TickerExchange } from '../services/market';

export interface ExchangeMeta {
  id: TickerExchange;
  label: string;
  color: string;
  currency: 'KRW' | 'USD';
  /** 거래소에서 쓰는 마켓 표기 */
  market: (coin: string) => string;
  /** TradingView 심볼 */
  tv: (coin: string) => string;
}

export const EXCHANGES: ExchangeMeta[] = [
  { id: 'upbit', label: 'Upbit', color: '#093687', currency: 'KRW', market: c => `KRW-${c}`, tv: c => `UPBIT:${c}KRW` },
  { id: 'coinone', label: 'Coinone', color: '#1f5eff', currency: 'KRW', market: c => `${c}/KRW`, tv: c => `COINONE:${c}KRW` },
  { id: 'bithumb', label: 'Bithumb', color: '#f37321', currency: 'KRW', market: c => `${c}_KRW`, tv: c => `BITHUMB:${c}KRW` },
  { id: 'korbit', label: 'Korbit', color: '#0aa4c2', currency: 'KRW', market: c => `${c.toLowerCase()}_krw`, tv: c => `KORBIT:${c}KRW` },
  { id: 'gateio', label: 'Gateio', color: '#2354e6', currency: 'USD', market: c => `${c}_USDT`, tv: c => `GATEIO:${c}USDT` },
  { id: 'binance', label: 'Binance', color: '#f0b90b', currency: 'USD', market: c => `${c}USDT`, tv: c => `BINANCE:${c}USDT` },
];

export const exchangeMeta = (id: TickerExchange) => EXCHANGES.find(e => e.id === id)!;
