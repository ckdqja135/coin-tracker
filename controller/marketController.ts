import { Request, Response } from 'express';
import {
    getKlines,
    getMetric,
    getLongShort,
    getLongShortPeriods,
    getPremium,
    getSnapshot,
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
 */
export const klines = async (req: Request, res: Response) => {
    const { source = 'binance', symbol, interval = '1h' } = req.query as Record<string, string>;
    if (!KLINE_SOURCES.includes(source as KlineSource)) return badRequest(res, `source must be one of ${KLINE_SOURCES.join(', ')}`);
    if (!symbol || !SYMBOL_RE.test(symbol)) return badRequest(res, 'symbol is required');
    if (!INTERVALS.includes(interval as Interval)) return badRequest(res, `interval must be one of ${INTERVALS.join(', ')}`);

    try {
        const data = await getKlines(source as KlineSource, symbol, interval as Interval, parseLimit(req.query.limit, 500));
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
