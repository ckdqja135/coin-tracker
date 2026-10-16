import { summarizeCoin, summarizeMarket } from './summary';
import type { ExchangeTickers, Notice, Ticker, TickerExchange } from '../services/market';

const DAY = 86_400_000;
const now = 100 * DAY;
const n = (p: Partial<Notice>): Notice => ({ exchange: 'upbit', title: '', category: '', kind: 'listing', coins: [], url: '', time: now - 1000, ...p });
const tk = (price: number, change24h: number | null = 0, high: number | null = null, low: number | null = null): Ticker => ({ price, change24h, high, low });
const ex = (exchange: TickerExchange, data: Record<string, Ticker>, usdKrw: number | null = 1000): ExchangeTickers =>
  ({ exchange, currency: ['gateio', 'binance'].includes(exchange) ? 'USD' : 'KRW', time: now, usdKrw, data });
const keys = (facts: { key: string }[]) => facts.map(f => f.key);

describe('summarizeCoin', () => {
  it('공지·등락·BTC 대비·김프·거래소 간 가격 차를 중요한 순서로 고른다', () => {
    const tickers = {
      upbit: ex('upbit', { BTC: tk(100_000, 1), XYZ: tk(1050, 10.1) }),
      bithumb: ex('bithumb', { XYZ: tk(1000, 5) }),
      binance: ex('binance', { XYZ: tk(1) }),
    };
    const notices = [
      n({ kind: 'warning', coins: ['XYZ'], exchange: 'bithumb', time: now - 2 * DAY }),
      n({ kind: 'listing', coins: ['XYZ'], time: now - 1.5 * DAY }),
    ];
    const facts = summarizeCoin({ coin: 'XYZ', base: 'upbit', tickers, notices, now });
    expect(keys(facts)).toEqual(['sum.warning', 'sum.new', 'sum.changeToday', 'sum.vsBtc', 'sum.kimp', 'sum.gap']);
    expect(facts[1].vars?.days).toBe('2');
    expect(facts[3].vars?.v).toBe('+9.01%');
    // 1050원 / 1000원·달러 / 1달러 = +5% → 강조
    expect(facts[4]).toMatchObject({ strong: true, vars: { v: '+5.00%', ex: 'Upbit', vs: 'Binance' } });
    expect(facts[5].vars).toMatchObject({ hi: 'Upbit', lo: 'Bithumb', v: '5.00' });
  });

  it('해제 공지가 나온 유의 종목과 오래된 공지는 빼고, BTC는 BTC 대비를 만들지 않는다', () => {
    const notices = [
      n({ kind: 'warning', coins: ['BTC'], time: now - 3 * DAY }),
      n({ kind: 'other', coins: ['BTC'], title: '비트코인(BTC) 유의 종목 지정 해제', time: now - DAY }),
      n({ kind: 'delisting', coins: ['BTC'], time: now - 40 * DAY }),
    ];
    const tickers = { binance: ex('binance', { BTC: tk(100, -2, 110, 99.5) }) };
    expect(keys(summarizeCoin({ coin: 'BTC', base: 'binance', tickers, notices, now }))).toEqual(['sum.change', 'sum.nearLow']);
  });
});

describe('summarizeMarket', () => {
  it('등락 분포, 상하위 종목, 최근 24시간 공지를 모은다', () => {
    const upbit = ex('upbit', { BTC: tk(1, 1), A: tk(1, 30), B: tk(1, -20), C: tk(1, 0), D: tk(1, null) });
    const notices = [
      n({ coins: ['NEW1'] }),
      n({ coins: ['NEW1'], exchange: 'bithumb' }),
      n({ coins: ['OLD'], time: now - 2 * DAY }),
      n({ kind: 'delisting', coins: ['GONE'] }),
    ];
    const m = summarizeMarket(upbit, notices, now, 2);
    expect(m).toMatchObject({ btc: 1, up: 2, down: 1, listings: ['NEW1'], warnings: [], delistings: ['GONE'] });
    expect(m.gainers.map(g => g.coin)).toEqual(['A', 'BTC']);
    expect(m.losers.map(g => g.coin)).toEqual(['B']);
  });
});
