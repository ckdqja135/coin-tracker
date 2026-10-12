import axios from 'axios';
import logger from '../log/logger';

/**
 * 외부 거래소/시장 데이터 프록시 서비스
 * - 모든 응답은 거래소와 무관하게 정규화된 형태로 반환한다.
 * - DB 없이 동작하며, 짧은 TTL의 메모리 캐시로 외부 API 호출량을 줄인다.
 */

export type Interval = '1m' | '5m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type KlineSource = 'binance' | 'binance-futures' | 'upbit' | 'bithumb' | 'yahoo';
export type MetricType = 'oi' | 'lsr' | 'top-lsr' | 'taker' | 'funding';
export type LongShortExchange = 'binance' | 'bybit' | 'okx';

export const INTERVALS: Interval[] = ['1m', '5m', '30m', '1h', '4h', '1d', '1w', '1M'];
export const KLINE_SOURCES: KlineSource[] = ['binance', 'binance-futures', 'upbit', 'bithumb', 'yahoo'];
export const METRIC_TYPES: MetricType[] = ['oi', 'lsr', 'top-lsr', 'taker', 'funding'];
export const LONG_SHORT_EXCHANGES: LongShortExchange[] = ['binance', 'bybit', 'okx'];

export interface Candle {
    t: number; // open time (ms)
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
}

export interface Point {
    t: number;
    v: number;
}

export interface LongShortPoint {
    t: number;
    long: number;  // 0~1
    short: number; // 0~1
    ratio: number;
}

const http = axios.create({
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (coin-tracker)' },
});

// ---------------------------------------------------------------------------
// 캐시
// ---------------------------------------------------------------------------
const cache = new Map<string, { expires: number; value: Promise<any> }>();

const cached = <T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expires > now) return hit.value;

    const value = loader().catch(err => {
        cache.delete(key); // 실패한 요청은 캐시하지 않음
        throw err;
    });
    cache.set(key, { expires: now + ttlMs, value });

    if (cache.size > 2000) {
        cache.forEach((entry, k) => { if (entry.expires <= now) cache.delete(k); });
    }
    return value;
};

const ttlFor = (interval: Interval): number => {
    switch (interval) {
        case '1m': return 5_000;
        case '5m': return 15_000;
        case '30m':
        case '1h': return 30_000;
        default: return 60_000;
    }
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// ---------------------------------------------------------------------------
// 캔들
// ---------------------------------------------------------------------------
const fetchBinanceKlines = async (base: string, symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
    const max = base.includes('fapi') ? 1500 : 1000;
    const path = base.includes('fapi') ? '/fapi/v1/klines' : '/api/v3/klines';
    const { data } = await http.get(`${base}${path}`, {
        params: { symbol, interval, limit: clamp(limit, 1, max) },
    });
    return data.map((k: any[]) => ({
        t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5],
    }));
};

const UPBIT_PATH: Record<Interval, string> = {
    '1m': 'minutes/1', '5m': 'minutes/5', '30m': 'minutes/30', '1h': 'minutes/60',
    '4h': 'minutes/240', '1d': 'days', '1w': 'weeks', '1M': 'months',
};

// 업비트는 1회 200개 제한 -> to 파라미터로 과거 방향 페이지네이션
const fetchUpbitKlines = async (symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
    const market = symbol.includes('-') ? symbol : `KRW-${symbol}`;
    const target = clamp(limit, 1, 1000);
    const out: Candle[] = [];
    let to: string | undefined;

    while (out.length < target) {
        const count = Math.min(200, target - out.length);
        const { data } = await http.get(`https://api.upbit.com/v1/candles/${UPBIT_PATH[interval]}`, {
            params: { market, count, ...(to ? { to } : {}) },
        });
        if (!Array.isArray(data) || data.length === 0) break;
        for (const k of data) {
            out.push({
                t: new Date(k.candle_date_time_utc + 'Z').getTime(),
                o: k.opening_price, h: k.high_price, l: k.low_price, c: k.trade_price,
                v: k.candle_acc_trade_volume,
            });
        }
        to = data[data.length - 1].candle_date_time_utc.replace('T', ' ');
        if (data.length < count) break;
    }
    return out.sort((a, b) => a.t - b.t);
};

const BITHUMB_INTERVAL: Partial<Record<Interval, string>> = {
    '1m': '1m', '5m': '5m', '30m': '30m', '1h': '1h', '1d': '24h',
};

const fetchBithumbKlines = async (symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
    const coin = symbol.replace(/^KRW-/, '').replace(/_KRW$/, '');
    // 빗썸이 지원하지 않는 단위는 하위 단위를 받아 리샘플링
    const native = BITHUMB_INTERVAL[interval];
    const fetchInterval = native ?? (interval === '4h' ? '1h' : '24h');
    const { data } = await http.get(`https://api.bithumb.com/public/candlestick/${coin}_KRW/${fetchInterval}`);
    if (data.status !== '0000') throw new Error(`Bithumb error: ${data.message || data.status}`);

    // [time, open, close, high, low, volume]
    let candles: Candle[] = data.data.map((k: any[]) => ({
        t: +k[0], o: +k[1], c: +k[2], h: +k[3], l: +k[4], v: +k[5],
    }));
    if (!native) candles = resample(candles, interval);
    return candles.slice(-clamp(limit, 1, 5000));
};

const YAHOO_INTERVAL: Record<Interval, { interval: string; resampleTo?: Interval }> = {
    '1m': { interval: '1m' },
    '5m': { interval: '5m' },
    '30m': { interval: '30m' },
    '1h': { interval: '60m' },
    '4h': { interval: '60m', resampleTo: '4h' },
    '1d': { interval: '1d' },
    '1w': { interval: '1wk' },
    '1M': { interval: '1mo' },
};

// 야후는 interval별로 조회 가능한 최대 기간이 다르다
const yahooRange = (interval: Interval, limit: number): string => {
    const days = (INTERVAL_MS[interval] * limit) / DAY_MS;
    const cap: Partial<Record<Interval, number>> = { '1m': 7, '5m': 59, '30m': 59, '1h': 729, '4h': 729 };
    const d = Math.min(days, cap[interval] ?? Infinity);
    if (d <= 1) return '1d';
    if (d <= 5) return '5d';
    if (d <= 30) return '1mo';
    if (d <= 60) return interval === '5m' || interval === '30m' ? '60d' : '3mo';
    if (d <= 90) return '3mo';
    if (d <= 180) return '6mo';
    if (d <= 365) return '1y';
    if (d <= 730) return '2y';
    if (d <= 1825) return '5y';
    if (d <= 3650) return '10y';
    return 'max';
};

const fetchYahooKlines = async (symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
    const conf = YAHOO_INTERVAL[interval];
    const { data } = await http.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
        params: { interval: conf.interval, range: yahooRange(interval, limit) },
    });
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return [];
    const q = result.indicators.quote[0];
    let candles: Candle[] = [];
    result.timestamp.forEach((ts: number, i: number) => {
        if (q.close[i] == null) return;
        candles.push({
            t: ts * 1000,
            o: q.open[i] ?? q.close[i], h: q.high[i] ?? q.close[i], l: q.low[i] ?? q.close[i], c: q.close[i],
            v: q.volume?.[i] ?? 0,
        });
    });
    if (conf.resampleTo) candles = resample(candles, conf.resampleTo);
    return candles.slice(-clamp(limit, 1, 5000));
};

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;
const INTERVAL_MS: Record<Interval, number> = {
    '1m': MIN_MS, '5m': 5 * MIN_MS, '30m': 30 * MIN_MS, '1h': 60 * MIN_MS, '4h': 240 * MIN_MS,
    '1d': DAY_MS, '1w': 7 * DAY_MS, '1M': 30 * DAY_MS,
};

const bucketStart = (t: number, interval: Interval): number => {
    if (interval === '1M') {
        const d = new Date(t);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }
    if (interval === '1w') {
        // 월요일 시작 (1970-01-01은 목요일)
        const offset = 4 * DAY_MS;
        return Math.floor((t - offset) / INTERVAL_MS['1w']) * INTERVAL_MS['1w'] + offset;
    }
    return Math.floor(t / INTERVAL_MS[interval]) * INTERVAL_MS[interval];
};

export const resample = (candles: Candle[], interval: Interval): Candle[] => {
    const out: Candle[] = [];
    for (const k of candles) {
        const t = bucketStart(k.t, interval);
        const last = out[out.length - 1];
        if (last && last.t === t) {
            last.h = Math.max(last.h, k.h);
            last.l = Math.min(last.l, k.l);
            last.c = k.c;
            last.v += k.v;
        } else {
            out.push({ ...k, t });
        }
    }
    return out;
};

export const getKlines = (source: KlineSource, symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
    const key = `kl:${source}:${symbol}:${interval}:${limit}`;
    return cached(key, ttlFor(interval), () => {
        switch (source) {
            case 'binance': return fetchBinanceKlines('https://api.binance.com', symbol, interval, limit);
            case 'binance-futures': return fetchBinanceKlines('https://fapi.binance.com', symbol, interval, limit);
            case 'upbit': return fetchUpbitKlines(symbol, interval, limit);
            case 'bithumb': return fetchBithumbKlines(symbol, interval, limit);
            case 'yahoo': return fetchYahooKlines(symbol, interval, limit);
        }
    });
};

// ---------------------------------------------------------------------------
// 파생 지표 (바이낸스 선물)
// ---------------------------------------------------------------------------

// futures/data/* 엔드포인트가 지원하는 period (최근 30일까지만 제공)
const FUTURES_PERIOD: Record<Interval, string> = {
    '1m': '5m', '5m': '5m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1d', '1M': '1d',
};

export const getMetric = (type: MetricType, symbol: string, interval: Interval, limit: number): Promise<Point[]> => {
    const period = FUTURES_PERIOD[interval];
    const key = `m:${type}:${symbol}:${period}:${limit}`;
    return cached(key, ttlFor(interval), async () => {
        const base = 'https://fapi.binance.com';
        const lim = clamp(limit, 1, 500);
        switch (type) {
            case 'oi': {
                const { data } = await http.get(`${base}/futures/data/openInterestHist`, { params: { symbol, period, limit: lim } });
                return data.map((d: any) => ({ t: d.timestamp, v: +d.sumOpenInterestValue }));
            }
            case 'lsr': {
                const { data } = await http.get(`${base}/futures/data/globalLongShortAccountRatio`, { params: { symbol, period, limit: lim } });
                return data.map((d: any) => ({ t: d.timestamp, v: +d.longShortRatio }));
            }
            case 'top-lsr': {
                const { data } = await http.get(`${base}/futures/data/topLongShortPositionRatio`, { params: { symbol, period, limit: lim } });
                return data.map((d: any) => ({ t: d.timestamp, v: +d.longShortRatio }));
            }
            case 'taker': {
                const { data } = await http.get(`${base}/futures/data/takerlongshortRatio`, { params: { symbol, period, limit: lim } });
                return data.map((d: any) => ({ t: d.timestamp, v: +d.buySellRatio }));
            }
            case 'funding': {
                const { data } = await http.get(`${base}/fapi/v1/fundingRate`, { params: { symbol, limit: clamp(limit, 1, 1000) } });
                return data.map((d: any) => ({ t: d.fundingTime, v: +d.fundingRate * 100 }));
            }
        }
    });
};

// ---------------------------------------------------------------------------
// 거래소별 롱/숏 비율
// ---------------------------------------------------------------------------
const LS_PERIOD: Record<LongShortExchange, Partial<Record<string, string>>> = {
    binance: { '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '2h': '2h', '4h': '4h', '12h': '12h', '1d': '1d' },
    bybit: { '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1h', '4h': '4h', '1d': '1d' },
    okx: { '5m': '5m', '1h': '1H', '1d': '1D' },
};

export const getLongShortPeriods = (exchange: LongShortExchange): string[] => Object.keys(LS_PERIOD[exchange]);

export const getLongShort = (exchange: LongShortExchange, coin: string, period: string, limit: number): Promise<LongShortPoint[]> => {
    const p = LS_PERIOD[exchange][period];
    if (!p) return Promise.reject(new Error(`Unsupported period ${period} for ${exchange}`));
    const lim = clamp(limit, 1, exchange === 'okx' ? 100 : exchange === 'bybit' ? 500 : 500);
    const key = `ls:${exchange}:${coin}:${p}:${lim}`;

    return cached(key, 30_000, async (): Promise<LongShortPoint[]> => {
        switch (exchange) {
            case 'binance': {
                const { data } = await http.get('https://fapi.binance.com/futures/data/globalLongShortAccountRatio', {
                    params: { symbol: `${coin}USDT`, period: p, limit: lim },
                });
                return data.map((d: any) => ({ t: d.timestamp, long: +d.longAccount, short: +d.shortAccount, ratio: +d.longShortRatio }));
            }
            case 'bybit': {
                const { data } = await http.get('https://api.bybit.com/v5/market/account-ratio', {
                    params: { category: 'linear', symbol: `${coin}USDT`, period: p, limit: lim },
                });
                if (data.retCode !== 0) throw new Error(`Bybit error: ${data.retMsg}`);
                return data.result.list
                    .map((d: any) => ({ t: +d.timestamp, long: +d.buyRatio, short: +d.sellRatio, ratio: +d.buyRatio / +d.sellRatio }))
                    .sort((a: LongShortPoint, b: LongShortPoint) => a.t - b.t);
            }
            case 'okx': {
                const { data } = await http.get('https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio', {
                    params: { ccy: coin, period: p },
                });
                if (data.code !== '0') throw new Error(`OKX error: ${data.msg}`);
                return data.data
                    .slice(0, lim)
                    .map((d: string[]) => {
                        const ratio = +d[1];
                        const long = ratio / (1 + ratio);
                        return { t: +d[0], long, short: 1 - long, ratio };
                    })
                    .sort((a: LongShortPoint, b: LongShortPoint) => a.t - b.t);
            }
        }
    });
};

// ---------------------------------------------------------------------------
// 김치 프리미엄 (국내 거래소 KRW 가격 vs 바이낸스 USDT 가격 * 환율)
// ---------------------------------------------------------------------------
export const getPremium = async (coin: string, exchange: 'upbit' | 'bithumb', interval: Interval, limit: number): Promise<Point[]> => {
    // 환율은 1h 미만 단위 데이터가 부족하므로 일/시간 단위 환율을 그대로 사용 (as-of join)
    const fxInterval: Interval = ['1m', '5m', '30m', '1h', '4h'].includes(interval) ? '1h' : '1d';
    const fxLimit = fxInterval === '1h'
        ? Math.ceil((INTERVAL_MS[interval] * limit) / INTERVAL_MS['1h']) + 72
        : Math.ceil((INTERVAL_MS[interval] * limit) / DAY_MS) + 7;

    const [krw, usd, fx] = await Promise.all([
        getKlines(exchange, coin, interval, limit),
        getKlines('binance', `${coin}USDT`, interval, limit),
        getKlines('yahoo', 'KRW=X', fxInterval, fxLimit),
    ]);
    if (fx.length === 0) return [];

    const usdByTime = new Map(usd.map(k => [k.t, k.c]));
    const out: Point[] = [];
    let fi = 0;
    for (const k of krw) {
        const u = usdByTime.get(k.t);
        if (u == null) continue;
        while (fi + 1 < fx.length && fx[fi + 1].t <= k.t) fi++;
        const rate = fx[fi].c;
        out.push({ t: k.t, v: ((k.c / (u * rate)) - 1) * 100 });
    }
    return out;
};

// ---------------------------------------------------------------------------
// 코인 요약 정보
// ---------------------------------------------------------------------------
export interface CoinSnapshot {
    coin: string;
    price: number;
    change24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;      // quote volume (USDT)
    openInterest: number | null; // USD
    fundingRate: number | null;  // %
    nextFundingTime: number | null;
    longShortRatio: number | null;
    krwPrice: { upbit: number | null; bithumb: number | null };
    usdKrw: number | null;
    premium: { upbit: number | null; bithumb: number | null };
}

const safe = async <T>(p: Promise<T>): Promise<T | null> => {
    try { return await p; } catch (err: any) {
        logger.warn(`snapshot partial failure: ${err.message}`);
        return null;
    }
};

export const getSnapshot = (coin: string): Promise<CoinSnapshot> => cached(`snap:${coin}`, 5_000, async () => {
    const symbol = `${coin}USDT`;
    const [ticker, premiumIndex, oi, lsr, upbit, bithumb, fx] = await Promise.all([
        http.get('https://api.binance.com/api/v3/ticker/24hr', { params: { symbol } }).then(r => r.data),
        safe(http.get('https://fapi.binance.com/fapi/v1/premiumIndex', { params: { symbol } }).then(r => r.data)),
        safe(http.get('https://fapi.binance.com/fapi/v1/openInterest', { params: { symbol } }).then(r => r.data)),
        safe(getLongShort('binance', coin, '5m', 1)),
        safe(http.get('https://api.upbit.com/v1/ticker', { params: { markets: `KRW-${coin}` } }).then(r => r.data[0]?.trade_price as number)),
        safe(http.get(`https://api.bithumb.com/public/ticker/${coin}_KRW`).then(r => (r.data.status === '0000' ? +r.data.data.closing_price : null))),
        safe(getKlines('yahoo', 'KRW=X', '1h', 2).then(k => k[k.length - 1]?.c ?? null)),
    ]);

    const price = +ticker.lastPrice;
    const premium = (krw: number | null | undefined) => (krw && fx ? ((krw / (price * fx)) - 1) * 100 : null);
    const markPrice = premiumIndex ? +premiumIndex.markPrice : price;

    return {
        coin,
        price,
        change24h: +ticker.priceChangePercent,
        high24h: +ticker.highPrice,
        low24h: +ticker.lowPrice,
        volume24h: +ticker.quoteVolume,
        openInterest: oi ? +oi.openInterest * markPrice : null,
        fundingRate: premiumIndex ? +premiumIndex.lastFundingRate * 100 : null,
        nextFundingTime: premiumIndex ? +premiumIndex.nextFundingTime : null,
        longShortRatio: lsr?.[lsr.length - 1]?.ratio ?? null,
        krwPrice: { upbit: upbit ?? null, bithumb: bithumb ?? null },
        usdKrw: fx ?? null,
        premium: { upbit: premium(upbit), bithumb: premium(bithumb) },
    };
});
