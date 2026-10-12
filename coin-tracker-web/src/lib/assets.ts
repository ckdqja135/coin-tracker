import { KlineSource } from '../services/market';

export type AssetCategory = 'crypto' | 'indices' | 'commodity' | 'fx';

export interface Asset {
  id: string;        // URL/저장용 고유 키
  name: string;
  short: string;     // 표시용 티커
  category: AssetCategory;
  source: KlineSource;
  symbol: string;    // 데이터 소스 심볼
  currency: 'USD' | 'KRW';
}

const crypto = (coin: string, name: string): Asset => ({
  id: coin, name, short: coin, category: 'crypto', source: 'binance', symbol: `${coin}USDT`, currency: 'USD',
});

const yahoo = (id: string, name: string, short: string, symbol: string, category: AssetCategory): Asset => ({
  id, name, short, category, source: 'yahoo', symbol, currency: 'USD',
});

export const ASSETS: Asset[] = [
  crypto('BTC', 'Bitcoin'),
  crypto('ETH', 'Ethereum'),
  crypto('BNB', 'BNB'),
  crypto('SOL', 'Solana'),
  crypto('XRP', 'XRP'),
  crypto('DOGE', 'Dogecoin'),
  crypto('ADA', 'Cardano'),
  crypto('AVAX', 'Avalanche'),
  crypto('LINK', 'Chainlink'),
  crypto('DOT', 'Polkadot'),
  crypto('TRX', 'TRON'),
  crypto('LTC', 'Litecoin'),
  yahoo('SPX', 'S&P 500', 'SPX', '^GSPC', 'indices'),
  yahoo('NDX', 'NASDAQ 100', 'NDX', '^NDX', 'indices'),
  yahoo('DJI', 'Dow Jones', 'DJI', '^DJI', 'indices'),
  yahoo('KOSPI', 'KOSPI', 'KOSPI', '^KS11', 'indices'),
  yahoo('N225', 'Nikkei 225', 'N225', '^N225', 'indices'),
  yahoo('VIX', 'VIX', 'VIX', '^VIX', 'indices'),
  yahoo('DXY', 'US Dollar Index', 'DXY', 'DX-Y.NYB', 'indices'),
  yahoo('GOLD', 'Gold', 'GOLD', 'GC=F', 'commodity'),
  yahoo('SILVER', 'Silver', 'SILVER', 'SI=F', 'commodity'),
  yahoo('OIL', 'Crude Oil (WTI)', 'WTI', 'CL=F', 'commodity'),
  yahoo('NATGAS', 'Natural Gas', 'NG', 'NG=F', 'commodity'),
  yahoo('COPPER', 'Copper', 'COPPER', 'HG=F', 'commodity'),
  { id: 'USDKRW', name: 'USD/KRW', short: 'USDKRW', category: 'fx', source: 'yahoo', symbol: 'KRW=X', currency: 'KRW' },
];

export const CRYPTO_COINS = ASSETS.filter(a => a.category === 'crypto').map(a => a.id);

export const findAsset = (id: string | null | undefined): Asset | undefined =>
  ASSETS.find(a => a.id.toLowerCase() === (id || '').toLowerCase());

export const searchAssets = (query: string): Asset[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ASSETS.filter(a => a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)).slice(0, 10);
};
