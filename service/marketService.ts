import axios from 'axios';
import logger from '../log/logger';

/**
 * 외부 거래소/시장 데이터 프록시 서비스
 * - 모든 응답은 거래소와 무관하게 정규화된 형태로 반환한다.
 * - DB 없이 동작하며, 짧은 TTL의 메모리 캐시로 외부 API 호출량을 줄인다.
 */

export type Interval = '1m' | '5m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type KlineSource = 'binance' | 'binance-futures' | 'upbit' | 'bithumb' | 'coinone' | 'korbit' | 'gateio' | 'yahoo';
export type MetricType = 'oi' | 'lsr' | 'top-lsr' | 'taker' | 'funding';
export type LongShortExchange = 'binance' | 'bybit' | 'okx';

export const INTERVALS: Interval[] = ['1m', '5m', '30m', '1h', '4h', '1d', '1w', '1M'];
export const KLINE_SOURCES: KlineSource[] = ['binance', 'binance-futures', 'upbit', 'bithumb', 'coinone', 'korbit', 'gateio', 'yahoo'];
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
// 거래소별 호출 간격 제한 + 429 재시도
// 국내 거래소는 IP당 초당 요청 수 제한이 있어, 같은 호스트로 가는 요청 사이에 최소 간격을 둔다.
// ---------------------------------------------------------------------------
const MIN_GAP_MS: Record<string, number> = {
    'api.upbit.com': 125,     // 캔들 API 초당 약 10회
    'api.bithumb.com': 110,
    'api.coinone.co.kr': 110,
    'api.korbit.co.kr': 125,
};
const nextSlot = new Map<string, number>();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

http.interceptors.request.use(async config => {
    const host = new URL(config.url!, config.baseURL).hostname;
    const gap = MIN_GAP_MS[host];
    if (gap) {
        const now = Date.now();
        const slot = Math.max(now, nextSlot.get(host) ?? 0);
        nextSlot.set(host, slot + gap);
        if (slot > now) await sleep(slot - now);
    }
    return config;
});

http.interceptors.response.use(undefined, async err => {
    const config = err.config as (typeof err.config & { __retry?: number }) | undefined;
    if (err.response?.status === 429 && config && (config.__retry ?? 0) < 3) {
        config.__retry = (config.__retry ?? 0) + 1;
        // 업비트는 Remaining-Req 헤더로 남은 횟수를 알려주지만, 단순히 점점 길게 기다린다
        await sleep(400 * config.__retry);
        return http.request(config);
    }
    throw err;
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

const COINONE_INTERVAL: Record<Interval, string> = {
    '1m': '1m', '5m': '5m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w', '1M': '1mon',
};

const fetchCoinoneKlines = async (symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
    const coin = symbol.replace(/^KRW-/, '').toUpperCase();
    const { data } = await http.get(`https://api.coinone.co.kr/public/v2/chart/KRW/${coin}`, {
        params: { interval: COINONE_INTERVAL[interval], size: clamp(limit, 1, 500) },
    });
    if (data.result !== 'success') throw new Error(`Coinone error: ${data.error_code}`);
    return data.chart
        .map((k: any) => ({ t: +k.timestamp, o: +k.open, h: +k.high, l: +k.low, c: +k.close, v: +k.target_volume }))
        .sort((a: Candle, b: Candle) => a.t - b.t);
};

const KORBIT_INTERVAL: Record<Interval, string> = {
    '1m': '1', '5m': '5', '30m': '30', '1h': '60', '4h': '240', '1d': '1D', '1w': '1W', '1M': '1W',
};

const fetchKorbitKlines = async (symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
    const coin = symbol.replace(/^KRW-/, '').toLowerCase();
    const { data } = await http.get('https://api.korbit.co.kr/v2/candles', {
        params: { symbol: `${coin}_krw`, interval: KORBIT_INTERVAL[interval], limit: clamp(limit, 1, 200) },
    });
    if (!data.success) throw new Error('Korbit error');
    return data.data
        .map((k: any) => ({ t: +k.timestamp, o: +k.open, h: +k.high, l: +k.low, c: +k.close, v: +k.volume }))
        .sort((a: Candle, b: Candle) => a.t - b.t);
};

const GATE_INTERVAL: Record<Interval, string> = {
    '1m': '1m', '5m': '5m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '7d', '1M': '30d',
};

const fetchGateKlines = async (symbol: string, interval: Interval, limit: number): Promise<Candle[]> => {
    const coin = symbol.replace(/_?USDT$/, '').toUpperCase();
    const { data } = await http.get('https://api.gateio.ws/api/v4/spot/candlesticks', {
        params: { currency_pair: `${coin}_USDT`, interval: GATE_INTERVAL[interval], limit: clamp(limit, 1, 1000) },
    });
    // [time(s), quote_volume, close, high, low, open, base_volume, closed]
    return data.map((k: string[]) => ({ t: +k[0] * 1000, o: +k[5], h: +k[3], l: +k[4], c: +k[2], v: +k[6] }));
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
            case 'coinone': return fetchCoinoneKlines(symbol, interval, limit);
            case 'korbit': return fetchKorbitKlines(symbol, interval, limit);
            case 'gateio': return fetchGateKlines(symbol, interval, limit);
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

// ---------------------------------------------------------------------------
// 거래소별 전체 시세 (홈 비교표 / CIM)
// ---------------------------------------------------------------------------
export type TickerExchange = 'upbit' | 'coinone' | 'bithumb' | 'korbit' | 'gateio' | 'binance';
export const TICKER_EXCHANGES: TickerExchange[] = ['upbit', 'coinone', 'bithumb', 'korbit', 'gateio', 'binance'];

export interface Ticker {
    price: number;
    change24h: number | null; // %
    high: number | null;
    low: number | null;
}

export interface ExchangeTickers {
    exchange: TickerExchange;
    currency: 'KRW' | 'USD';
    time: number;
    data: Record<string, Ticker>;
}

const pct = (last: number, open: number) => (open ? (last / open - 1) * 100 : null);

const loadTickers = async (exchange: TickerExchange): Promise<ExchangeTickers> => {
    const data: Record<string, Ticker> = {};
    switch (exchange) {
        case 'upbit': {
            const markets = await getUpbitMarkets();
            const { data: rows } = await http.get('https://api.upbit.com/v1/ticker', {
                params: { markets: markets.map(m => m.market).join(',') },
            });
            for (const r of rows) {
                data[r.market.replace('KRW-', '')] = {
                    price: r.trade_price, change24h: r.signed_change_rate * 100, high: r.high_price, low: r.low_price,
                };
            }
            return { exchange, currency: 'KRW', time: Date.now(), data };
        }
        case 'coinone': {
            const { data: res } = await http.get('https://api.coinone.co.kr/public/v2/ticker_new/KRW', { params: { additional_data: false } });
            for (const r of res.tickers ?? []) {
                data[r.target_currency.toUpperCase()] = { price: +r.last, change24h: pct(+r.last, +r.first), high: +r.high, low: +r.low };
            }
            return { exchange, currency: 'KRW', time: Date.now(), data };
        }
        case 'bithumb': {
            const { data: res } = await http.get('https://api.bithumb.com/public/ticker/ALL_KRW');
            Object.entries<any>(res.data ?? {}).forEach(([coin, r]) => {
                if (coin === 'date') return;
                data[coin] = {
                    price: +r.closing_price, change24h: +r.fluctate_rate_24H, high: +r.max_price, low: +r.min_price,
                };
            });
            return { exchange, currency: 'KRW', time: Date.now(), data };
        }
        case 'korbit': {
            const { data: res } = await http.get('https://api.korbit.co.kr/v2/tickers');
            for (const r of res.data ?? []) {
                if (!r.symbol.endsWith('_krw')) continue;
                data[r.symbol.replace('_krw', '').toUpperCase()] = {
                    price: +r.close, change24h: +r.priceChangePercent, high: +r.high, low: +r.low,
                };
            }
            return { exchange, currency: 'KRW', time: Date.now(), data };
        }
        case 'gateio': {
            const { data: rows } = await http.get('https://api.gateio.ws/api/v4/spot/tickers');
            for (const r of rows) {
                if (!r.currency_pair.endsWith('_USDT')) continue;
                data[r.currency_pair.replace('_USDT', '')] = {
                    price: +r.last, change24h: +r.change_percentage, high: +r.high_24h, low: +r.low_24h,
                };
            }
            return { exchange, currency: 'USD', time: Date.now(), data };
        }
        case 'binance': {
            const { data: rows } = await http.get('https://api.binance.com/api/v3/ticker/24hr', { params: { type: 'MINI' } });
            for (const r of rows) {
                if (!r.symbol.endsWith('USDT')) continue;
                const last = +r.lastPrice;
                if (!last) continue;
                data[r.symbol.replace(/USDT$/, '')] = { price: last, change24h: pct(last, +r.openPrice), high: +r.highPrice, low: +r.lowPrice };
            }
            return { exchange, currency: 'USD', time: Date.now(), data };
        }
    }
};

export const getTickers = (exchange: TickerExchange): Promise<ExchangeTickers> =>
    cached(`tk:${exchange}`, 2_000, () => loadTickers(exchange));

export const getUsdKrw = (): Promise<number | null> =>
    cached('fx:usdkrw', 60_000, () => getKlines('yahoo', 'KRW=X', '1h', 2).then(k => k[k.length - 1]?.c ?? null));

// ---------------------------------------------------------------------------
// 코인 검색 목록 (업비트 원화마켓 + 바이낸스 USDT)
// ---------------------------------------------------------------------------
interface UpbitMarket { market: string; korean_name: string; english_name: string; }

const getUpbitMarkets = (): Promise<UpbitMarket[]> => cached('upbit:markets', 3_600_000, async () => {
    const { data } = await http.get('https://api.upbit.com/v1/market/all');
    return (data as UpbitMarket[]).filter(m => m.market.startsWith('KRW-'));
});

export interface CoinListItem { symbol: string; en: string; ko: string | null; }

export const getCoinList = (): Promise<CoinListItem[]> => cached('coins:list', 3_600_000, async () => {
    const [upbit, binance] = await Promise.all([getUpbitMarkets(), safe(getTickers('binance'))]);
    const map = new Map<string, CoinListItem>();
    upbit.forEach(m => {
        const symbol = m.market.replace('KRW-', '');
        map.set(symbol, { symbol, en: m.english_name, ko: m.korean_name });
    });
    Object.keys(binance?.data ?? {}).forEach(symbol => {
        if (!map.has(symbol)) map.set(symbol, { symbol, en: symbol, ko: null });
    });
    return Array.from(map.values());
});

// ---------------------------------------------------------------------------
// 홈 상단 지수 스트립 / 코인 요약 (CoinGecko + Yahoo)
// ---------------------------------------------------------------------------
export interface OverviewItem { id: string; name: string; value: number; change: number | null; changePct: number | null; }

const yahooQuote = async (id: string, name: string, symbol: string): Promise<OverviewItem | null> => {
    const k = await getKlines('yahoo', symbol, '1d', 5);
    if (k.length === 0) return null;
    const last = k[k.length - 1].c;
    const prev = k.length > 1 ? k[k.length - 2].c : null;
    return { id, name, value: last, change: prev != null ? last - prev : null, changePct: prev ? (last / prev - 1) * 100 : null };
};

export const getOverview = (): Promise<OverviewItem[]> => cached('overview', 60_000, async () => {
    const [spx, ndx, dxy, global] = await Promise.all([
        safe(yahooQuote('SPX', 'S&P 500', '^GSPC')),
        safe(yahooQuote('NDX', 'US 100', '^NDX')),
        safe(yahooQuote('DXY', 'Dollar Index', 'DX-Y.NYB')),
        safe(http.get('https://api.coingecko.com/api/v3/global').then(r => r.data.data)),
    ]);
    const items: (OverviewItem | null)[] = [spx, ndx, dxy];
    if (global) {
        const mcap = global.total_market_cap.usd as number;
        const chg = global.market_cap_change_percentage_24h_usd as number;
        items.push({ id: 'TOTAL', name: 'Crypto Total Market Cap', value: mcap, change: mcap - mcap / (1 + chg / 100), changePct: chg });
        items.push({ id: 'BTC.D', name: 'Dominance BTC', value: global.market_cap_percentage.btc, change: null, changePct: null });
    }
    return items.filter((x): x is OverviewItem => x != null);
});

export interface CoinInfo {
    symbol: string; name: string; image: string | null; price: number; change24h: number | null;
    high24h: number | null; low24h: number | null; marketCap: number | null;
}

export const getCoinInfo = (symbols: string[]): Promise<CoinInfo[]> => {
    const list = Array.from(new Set(symbols.map(s => s.toUpperCase()))).slice(0, 30).sort();
    return cached(`coininfo:${list.join(',')}`, 30_000, async () => {
        const { data } = await http.get('https://api.coingecko.com/api/v3/coins/markets', {
            params: { vs_currency: 'usd', symbols: list.join(',').toLowerCase() },
        });
        // 같은 심볼의 토큰이 여럿이면 시가총액 순위가 가장 높은 것을 사용
        const best = new Map<string, any>();
        for (const c of data) {
            const sym = String(c.symbol).toUpperCase();
            const cur = best.get(sym);
            if (!cur || (c.market_cap_rank ?? 1e9) < (cur.market_cap_rank ?? 1e9)) best.set(sym, c);
        }
        return list.filter(s => best.has(s)).map(s => {
            const c = best.get(s);
            return {
                symbol: s, name: c.name, image: c.image ?? null, price: c.current_price, change24h: c.price_change_percentage_24h,
                high24h: c.high_24h, low24h: c.low_24h, marketCap: c.market_cap,
            };
        });
    });
};

// ---------------------------------------------------------------------------
// 비교 카드용 보조 시계열 (거래소별 미결제약정, 공포탐욕지수, 해시레이트, 난이도)
// ---------------------------------------------------------------------------
export type SeriesKind = 'oi-binance' | 'oi-bybit' | 'oi-okx' | 'fng' | 'hashrate' | 'difficulty';
export const SERIES_KINDS: SeriesKind[] = ['oi-binance', 'oi-bybit', 'oi-okx', 'fng', 'hashrate', 'difficulty'];

const BYBIT_OI_INTERVAL: Record<Interval, string> = {
    '1m': '5min', '5m': '5min', '30m': '30min', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1d', '1M': '1d',
};
const OKX_PERIOD: Record<Interval, string> = {
    '1m': '5m', '5m': '5m', '30m': '1H', '1h': '1H', '4h': '1H', '1d': '1D', '1w': '1D', '1M': '1D',
};

const mempoolPeriod = (interval: Interval, limit: number) => {
    const days = (INTERVAL_MS[interval] * limit) / DAY_MS;
    if (days <= 31) return '1m';
    if (days <= 93) return '3m';
    if (days <= 186) return '6m';
    if (days <= 366) return '1y';
    if (days <= 732) return '2y';
    return '3y';
};

export const getSeries = (kind: SeriesKind, coin: string, interval: Interval, limit: number): Promise<Point[]> => {
    const key = `series:${kind}:${coin}:${interval}:${limit}`;
    return cached(key, ttlFor(interval), async (): Promise<Point[]> => {
        switch (kind) {
            case 'oi-binance':
                return getMetric('oi', `${coin}USDT`, interval, limit);
            case 'oi-bybit': {
                const { data } = await http.get('https://api.bybit.com/v5/market/open-interest', {
                    params: { category: 'linear', symbol: `${coin}USDT`, intervalTime: BYBIT_OI_INTERVAL[interval], limit: clamp(limit, 1, 200) },
                });
                if (data.retCode !== 0) throw new Error(`Bybit error: ${data.retMsg}`);
                return data.result.list.map((d: any) => ({ t: +d.timestamp, v: +d.openInterest })).sort((a: Point, b: Point) => a.t - b.t);
            }
            case 'oi-okx': {
                const { data } = await http.get('https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-volume', {
                    params: { ccy: coin, period: OKX_PERIOD[interval] },
                });
                if (data.code !== '0') throw new Error(`OKX error: ${data.msg}`);
                return data.data.slice(0, limit).map((d: string[]) => ({ t: +d[0], v: +d[1] })).sort((a: Point, b: Point) => a.t - b.t);
            }
            case 'fng': {
                const { data } = await http.get('https://api.alternative.me/fng/', { params: { limit: Math.ceil((INTERVAL_MS[interval] * limit) / DAY_MS) + 1 } });
                return data.data.map((d: any) => ({ t: +d.timestamp * 1000, v: +d.value })).sort((a: Point, b: Point) => a.t - b.t);
            }
            case 'hashrate':
            case 'difficulty': {
                const { data } = await http.get(`https://mempool.space/api/v1/mining/hashrate/${mempoolPeriod(interval, limit)}`);
                return kind === 'hashrate'
                    ? data.hashrates.map((d: any) => ({ t: d.timestamp * 1000, v: d.avgHashrate / 1e18 })) // EH/s
                    : data.difficulty.map((d: any) => ({ t: d.time * 1000, v: d.difficulty / 1e12 })); // T
            }
        }
    });
};

// ---------------------------------------------------------------------------
// 특정 시각 이후 캔들 (CIM: 한국시간 09시부터 1분봉)
// 거래소마다 1회 조회 개수 제한이 달라 시간 기준으로 페이지를 넘긴다.
// ---------------------------------------------------------------------------
const MAX_SINCE_POINTS = 1500;

/** 업비트·빗썸(v1)은 같은 형식. to 파라미터: 업비트는 UTC, 빗썸은 KST 문자열 */
const fetchUpbitLikeSince = async (
    base: string, coin: string, interval: Interval, since: number, tz: 'utc' | 'kst',
): Promise<Candle[]> => {
    const unit = INTERVAL_MS[interval] / MIN_MS;
    const out: Candle[] = [];
    let to: string | undefined;
    for (let page = 0; page < 10; page++) {
        const { data } = await http.get(`${base}/v1/candles/minutes/${unit}`, {
            params: { market: `KRW-${coin}`, count: 200, ...(to ? { to } : {}) },
        });
        if (!Array.isArray(data) || data.length === 0) break;
        for (const k of data) {
            out.push({
                t: new Date(k.candle_date_time_utc + 'Z').getTime(),
                o: k.opening_price, h: k.high_price, l: k.low_price, c: k.trade_price, v: k.candle_acc_trade_volume,
            });
        }
        const oldest = data[data.length - 1];
        if (new Date(oldest.candle_date_time_utc + 'Z').getTime() <= since || data.length < 200) break;
        to = (tz === 'utc' ? oldest.candle_date_time_utc : oldest.candle_date_time_kst).replace('T', ' ');
    }
    return out;
};

const fetchSince = async (source: KlineSource, symbol: string, interval: Interval, since: number): Promise<Candle[]> => {
    const step = INTERVAL_MS[interval];
    const now = Date.now();
    const coin = symbol.replace(/^KRW-/, '').replace(/_?(USDT|KRW)$/, '').toUpperCase();
    const out: Candle[] = [];

    switch (source) {
        case 'upbit':
            return fetchUpbitLikeSince('https://api.upbit.com', coin, interval, since, 'utc');
        case 'bithumb':
            return fetchUpbitLikeSince('https://api.bithumb.com', coin, interval, since, 'kst');
        case 'binance':
        case 'binance-futures': {
            const futures = source === 'binance-futures';
            let start = since;
            for (let page = 0; page < 3 && start < now; page++) {
                const { data } = await http.get(`https://${futures ? 'fapi' : 'api'}.binance.com${futures ? '/fapi/v1' : '/api/v3'}/klines`, {
                    params: { symbol: `${coin}USDT`, interval, startTime: start, limit: 1000 },
                });
                data.forEach((k: any[]) => out.push({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
                if (data.length < 1000) break;
                start = data[data.length - 1][0] + step;
            }
            return out;
        }
        case 'coinone': {
            let end = now;
            for (let page = 0; page < 5; page++) {
                const { data } = await http.get(`https://api.coinone.co.kr/public/v2/chart/KRW/${coin}`, {
                    params: { interval: COINONE_INTERVAL[interval], size: 500, timestamp: end },
                });
                if (data.result !== 'success' || !data.chart.length) break;
                data.chart.forEach((k: any) => out.push({ t: +k.timestamp, o: +k.open, h: +k.high, l: +k.low, c: +k.close, v: +k.target_volume }));
                const oldest = Math.min(...data.chart.map((k: any) => +k.timestamp));
                if (oldest <= since || data.is_last) break;
                end = oldest - 1;
            }
            return out;
        }
        case 'korbit': {
            let end = now;
            for (let page = 0; page < 10; page++) {
                const { data } = await http.get('https://api.korbit.co.kr/v2/candles', {
                    params: { symbol: `${coin.toLowerCase()}_krw`, interval: KORBIT_INTERVAL[interval], limit: 200, end },
                });
                if (!data.success || !data.data.length) break;
                data.data.forEach((k: any) => out.push({ t: +k.timestamp, o: +k.open, h: +k.high, l: +k.low, c: +k.close, v: +k.volume }));
                const oldest = Math.min(...data.data.map((k: any) => +k.timestamp));
                if (oldest <= since || data.data.length < 200) break;
                end = oldest - 1;
            }
            return out;
        }
        case 'gateio': {
            // from/to 구간당 최대 1000개
            for (let from = since; from < now; from += step * 1000) {
                const to = Math.min(now, from + step * 999);
                const { data } = await http.get('https://api.gateio.ws/api/v4/spot/candlesticks', {
                    params: { currency_pair: `${coin}_USDT`, interval: GATE_INTERVAL[interval], from: Math.floor(from / 1000), to: Math.floor(to / 1000) },
                });
                data.forEach((k: string[]) => out.push({ t: +k[0] * 1000, o: +k[5], h: +k[3], l: +k[4], c: +k[2], v: +k[6] }));
            }
            return out;
        }
        case 'yahoo':
            return getKlines('yahoo', symbol, interval, Math.ceil((now - since) / step) + 1);
    }
};

// 백필 캐시: 오늘 받아 둔 캔들은 그대로 두고, 마지막 캔들 이후 것만 추가로 받는다
const sinceStore = new Map<string, { candles: Candle[]; fetchedAt: number; pending?: Promise<Candle[]> }>();

export const getKlinesSince = async (source: KlineSource, symbol: string, interval: Interval, since: number): Promise<Candle[]> => {
    const key = `${source}:${symbol}:${interval}:${since}`;
    const entry = sinceStore.get(key);
    if (entry?.pending) return entry.pending;
    if (entry && Date.now() - entry.fetchedAt < 20_000) return entry.candles;

    const pending = (async () => {
        const prev = entry?.candles ?? [];
        // 마지막 캔들(아직 진행 중일 수 있음)부터 다시 받아 덮어쓴다
        const from = prev.length ? prev[prev.length - 1].t : since;
        const fresh = await fetchSince(source, symbol, interval, from);
        const map = new Map<number, Candle>();
        prev.forEach(k => map.set(k.t, k));
        fresh.forEach(k => { if (k.t >= since) map.set(k.t, k); });
        const candles = Array.from(map.values()).sort((a, b) => a.t - b.t).slice(-MAX_SINCE_POINTS);
        sinceStore.set(key, { candles, fetchedAt: Date.now() });
        // 지난 날짜 캐시 정리
        sinceStore.forEach((v, k) => { if (Number(k.split(':').pop()) < since) sinceStore.delete(k); });
        return candles;
    })();

    sinceStore.set(key, { candles: entry?.candles ?? [], fetchedAt: entry?.fetchedAt ?? 0, pending });
    try {
        return await pending;
    } catch (err) {
        // 실패하면 이전 캐시를 그대로 둔다
        if (entry) sinceStore.set(key, entry); else sinceStore.delete(key);
        throw err;
    }
};
