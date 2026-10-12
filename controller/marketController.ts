import { Request, Response } from 'express';
import {
    getKlines,
    getKlinesSince,
    getMetric,
    getLongShort,
    getLongShortPeriods,
    getPremium,
    getSnapshot,
    getTickers,
    getUsdKrw,
    getCoinList,
    getOverview,
    getCoinInfo,
    TICKER_EXCHANGES,
    TickerExchange,
    getSeries,
    SERIES_KINDS,
    SeriesKind,
    INTERVALS,
    KLINE_SOURCES,
    METRIC_TYPES,
    LONG_SHORT_EXCHANGES,
    Interval,
    KlineSource,
    MetricType,
    LongShortExchange,
} from '../service/marketService';
import logger from '../log/logger';

const SYMBOL_RE = /^[A-Za-z0-9^=._-]{1,20}$/;

const badRequest = (res: Response, error: string) => res.status(400).json({ error });

const parseLimit = (raw: unknown, fallback: number) => {
    const n = Number(raw ?? fallback);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const handleError = (res: Response, err: any, label: string) => {
    const status = err.response?.status;
    logger.error(`[market] ${label} failed: ${err.message}`);
    res.status(status && status < 500 ? 400 : 502).json({ error: `Upstream request failed: ${err.message}` });
};

/**
 * GET /api/market/klines?source=binance&symbol=BTCUSDT&interval=1h&limit=500
 * GET /api/market/klines?source=upbit&symbol=BTC&interval=1m&since=1791763200000
 */
export const klines = async (req: Request, res: Response) => {
    const { source = 'binance', symbol, interval = '1h' } = req.query as Record<string, string>;
    if (!KLINE_SOURCES.includes(source as KlineSource)) return badRequest(res, `source must be one of ${KLINE_SOURCES.join(', ')}`);
    if (!symbol || !SYMBOL_RE.test(symbol)) return badRequest(res, 'symbol is required');
    if (!INTERVALS.includes(interval as Interval)) return badRequest(res, `interval must be one of ${INTERVALS.join(', ')}`);

    // since(ms)를 주면 그 시각 이후 캔들을 모두 반환 (최대 1500개, 최근 3일 이내)
    const since = req.query.since != null ? Number(req.query.since) : null;
    if (since != null && (!Number.isFinite(since) || since < Date.now() - 3 * 86_400_000)) {
        return badRequest(res, 'since must be a timestamp (ms) within the last 3 days');
    }

    try {
        const data = since != null
            ? await getKlinesSince(source as KlineSource, symbol, interval as Interval, since)
            : await getKlines(source as KlineSource, symbol, interval as Interval, parseLimit(req.query.limit, 500));
        res.json({ source, symbol, interval, data });
    } catch (err: any) {
        handleError(res, err, 'klines');
    }
};

/**
 * GET /api/market/metric?type=oi&symbol=BTCUSDT&interval=1h&limit=500
 */
export const metric = async (req: Request, res: Response) => {
    const { type, symbol = 'BTCUSDT', interval = '1h' } = req.query as Record<string, string>;
    if (!METRIC_TYPES.includes(type as MetricType)) return badRequest(res, `type must be one of ${METRIC_TYPES.join(', ')}`);
    if (!SYMBOL_RE.test(symbol)) return badRequest(res, 'invalid symbol');
    if (!INTERVALS.includes(interval as Interval)) return badRequest(res, `interval must be one of ${INTERVALS.join(', ')}`);

    try {
        const data = await getMetric(type as MetricType, symbol, interval as Interval, parseLimit(req.query.limit, 500));
        res.json({ type, symbol, interval, data });
    } catch (err: any) {
        handleError(res, err, 'metric');
    }
};

/**
 * GET /api/market/longshort?exchange=binance&coin=BTC&period=1h&limit=100
 */
export const longShort = async (req: Request, res: Response) => {
    const { exchange = 'binance', coin = 'BTC', period = '1h' } = req.query as Record<string, string>;
    if (!LONG_SHORT_EXCHANGES.includes(exchange as LongShortExchange)) {
        return badRequest(res, `exchange must be one of ${LONG_SHORT_EXCHANGES.join(', ')}`);
    }
    if (!SYMBOL_RE.test(coin)) return badRequest(res, 'invalid coin');
    const periods = getLongShortPeriods(exchange as LongShortExchange);
    if (!periods.includes(period)) return badRequest(res, `period must be one of ${periods.join(', ')}`);

    try {
        const data = await getLongShort(exchange as LongShortExchange, coin.toUpperCase(), period, parseLimit(req.query.limit, 100));
        res.json({ exchange, coin, period, periods, data });
    } catch (err: any) {
        handleError(res, err, 'longshort');
    }
};

/**
 * GET /api/market/premium?coin=BTC&exchange=upbit&interval=1h&limit=500
 */
export const premium = async (req: Request, res: Response) => {
    const { coin = 'BTC', exchange = 'upbit', interval = '1h' } = req.query as Record<string, string>;
    if (exchange !== 'upbit' && exchange !== 'bithumb') return badRequest(res, 'exchange must be upbit or bithumb');
    if (!SYMBOL_RE.test(coin)) return badRequest(res, 'invalid coin');
    if (!INTERVALS.includes(interval as Interval)) return badRequest(res, `interval must be one of ${INTERVALS.join(', ')}`);

    try {
        const data = await getPremium(coin.toUpperCase(), exchange, interval as Interval, parseLimit(req.query.limit, 500));
        res.json({ coin, exchange, interval, data });
    } catch (err: any) {
        handleError(res, err, 'premium');
    }
};

/**
 * GET /api/market/snapshot?coin=BTC
 */
export const snapshot = async (req: Request, res: Response) => {
    const coin = String(req.query.coin || 'BTC').toUpperCase();
    if (!SYMBOL_RE.test(coin)) return badRequest(res, 'invalid coin');

    try {
        res.json(await getSnapshot(coin));
    } catch (err: any) {
        handleError(res, err, 'snapshot');
    }
};

/**
 * GET /api/market/tickers?exchange=upbit&coins=BTC,ETH
 */
export const tickers = async (req: Request, res: Response) => {
    const exchange = String(req.query.exchange || '');
    if (!TICKER_EXCHANGES.includes(exchange as TickerExchange)) {
        return badRequest(res, `exchange must be one of ${TICKER_EXCHANGES.join(', ')}`);
    }
    try {
        const [all, usdKrw] = await Promise.all([getTickers(exchange as TickerExchange), getUsdKrw().catch(() => null)]);
        // coins=BTC,ETH 로 필요한 코인만 받을 수 있다 (게이트는 2천 개가 넘음)
        const filter = String(req.query.coins || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
        const data = filter.length
            ? Object.fromEntries(filter.filter(c => all.data[c]).map(c => [c, all.data[c]]))
            : all.data;
        res.json({ ...all, data, usdKrw });
    } catch (err: any) {
        handleError(res, err, 'tickers');
    }
};

/**
 * GET /api/market/coins
 */
export const coins = async (_req: Request, res: Response) => {
    try {
        res.json(await getCoinList());
    } catch (err: any) {
        handleError(res, err, 'coins');
    }
};

/**
 * GET /api/market/overview
 */
export const overview = async (_req: Request, res: Response) => {
    try {
        res.json(await getOverview());
    } catch (err: any) {
        handleError(res, err, 'overview');
    }
};

/**
 * GET /api/market/coininfo?symbols=BTC,ETH
 */
export const coinInfo = async (req: Request, res: Response) => {
    const symbols = String(req.query.symbols || '').split(',').map(s => s.trim()).filter(s => SYMBOL_RE.test(s));
    if (symbols.length === 0) return badRequest(res, 'symbols is required');
    try {
        res.json(await getCoinInfo(symbols));
    } catch (err: any) {
        handleError(res, err, 'coininfo');
    }
};

/**
 * GET /api/market/series?kind=oi-bybit&coin=BTC&interval=1h&limit=200
 */
export const series = async (req: Request, res: Response) => {
    const { kind, coin = 'BTC', interval = '1h' } = req.query as Record<string, string>;
    if (!SERIES_KINDS.includes(kind as SeriesKind)) return badRequest(res, `kind must be one of ${SERIES_KINDS.join(', ')}`);
    if (!SYMBOL_RE.test(coin)) return badRequest(res, 'invalid coin');
    if (!INTERVALS.includes(interval as Interval)) return badRequest(res, `interval must be one of ${INTERVALS.join(', ')}`);
    try {
        res.json({ kind, coin, interval, data: await getSeries(kind as SeriesKind, coin.toUpperCase(), interval as Interval, parseLimit(req.query.limit, 300)) });
    } catch (err: any) {
        handleError(res, err, 'series');
    }
};
