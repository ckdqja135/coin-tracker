import logger from '../log/logger';

/**
 * 선물 강제청산 집계기 (롱/숏 페이지용)
 * - 서버가 켜져 있는 동안 바이낸스·바이비트·OKX의 BTC·ETH 청산 주문을 받는다.
 * - 1분 단위로 롱/숏 청산 금액(USD)을 최근 24시간치 쌓고, 최근 청산 건은 일정 개수 보관한다.
 * - 바이낸스는 심볼별로 1초에 가장 큰 청산 1건만 보내므로, 바이낸스 합계는 실제보다 작게 잡힌다.
 */

export type LiqExchange = 'binance' | 'bybit' | 'okx';
export const LIQ_EXCHANGES: LiqExchange[] = ['binance', 'bybit', 'okx'];
export const LIQ_COINS = ['BTC', 'ETH'] as const;
export type LiqCoin = typeof LIQ_COINS[number];

export const LIQ_WINDOWS: Record<string, number> = {
    '1h': 3600_000,
    '4h': 4 * 3600_000,
    '12h': 12 * 3600_000,
    '24h': 24 * 3600_000,
};

const KEEP_MS = 24 * 3600_000;
const MAX_RECENT = 300;
const OKX_CT_VAL: Record<LiqCoin, number> = { BTC: 0.01, ETH: 0.1 };

export interface Liquidation {
    exchange: LiqExchange;
    /** 청산된 포지션 방향 (long = 롱 포지션이 강제로 팔림) */
    side: 'long' | 'short';
    price: number;
    qty: number;
    usd: number;
    time: number;
}

interface Bucket { t: number; long: number; short: number }

// coin -> exchange -> 1분 버킷
const buckets: Record<string, Record<LiqExchange, Bucket[]>> = {};
const recent: Record<string, Liquidation[]> = {};
const connectedSince: Record<LiqExchange, number | null> = { binance: null, bybit: null, okx: null };

LIQ_COINS.forEach(c => {
    buckets[c] = { binance: [], bybit: [], okx: [] };
    recent[c] = [];
});

const record = (coin: LiqCoin, l: Liquidation) => {
    if (!l.usd || !Number.isFinite(l.usd)) return;
    const list = buckets[coin][l.exchange];
    const min = Math.floor(l.time / 60_000) * 60_000;
    let b = list[list.length - 1];
    if (!b || b.t !== min) {
        b = { t: min, long: 0, short: 0 };
        list.push(b);
        const cutoff = Date.now() - KEEP_MS;
        while (list.length && list[0].t < cutoff) list.shift();
    }
    b[l.side] += l.usd;
    const arr = recent[coin];
    arr.unshift(l);
    if (arr.length > MAX_RECENT) arr.length = MAX_RECENT;
};

const coinFrom = (s: string): LiqCoin | null => {
    const u = s.toUpperCase();
    if (u === 'BTCUSDT' || u === 'BTC-USDT-SWAP') return 'BTC';
    if (u === 'ETHUSDT' || u === 'ETH-USDT-SWAP') return 'ETH';
    return null;
};

interface Source {
    url: string;
    subscribe?: () => string[];
    ping?: { everyMs: number; message: string };
    parse: (msg: any) => { coin: LiqCoin; liq: Liquidation }[];
}

const SOURCES: Record<LiqExchange, Source> = {
    // 전체 심볼 청산 스트림 (S=SELL이면 롱 포지션 청산)
    binance: {
        url: 'wss://fstream.binance.com/market/stream?streams=!forceOrder@arr',
        parse: m => {
            const o = m.data?.o;
            if (m.data?.e !== 'forceOrder' || !o) return [];
            const coin = coinFrom(o.s);
            if (!coin) return [];
            const price = +o.ap || +o.p;
            const qty = +o.z || +o.q;
            return [{ coin, liq: { exchange: 'binance', side: o.S === 'SELL' ? 'long' : 'short', price, qty, usd: price * qty, time: +o.T } }];
        },
    },
    // S=Buy이면 롱 포지션 청산
    bybit: {
        url: 'wss://stream.bybit.com/v5/public/linear',
        subscribe: () => [JSON.stringify({ op: 'subscribe', args: ['allLiquidation.BTCUSDT', 'allLiquidation.ETHUSDT'] })],
        ping: { everyMs: 20_000, message: '{"op":"ping"}' },
        parse: m => {
            if (!m.topic?.startsWith('allLiquidation')) return [];
            return (m.data ?? []).flatMap((d: any) => {
                const coin = coinFrom(d.s);
                if (!coin) return [];
                const price = +d.p;
                const qty = +d.v;
                return [{ coin, liq: { exchange: 'bybit' as const, side: d.S === 'Buy' ? 'long' as const : 'short' as const, price, qty, usd: price * qty, time: +d.T } }];
            });
        },
    },
    // 전체 무기한 선물 청산 채널. posSide가 net이면 주문 방향(sell = 롱 청산)으로 판단
    okx: {
        url: 'wss://ws.okx.com:8443/ws/v5/public',
        subscribe: () => [JSON.stringify({ op: 'subscribe', args: [{ channel: 'liquidation-orders', instType: 'SWAP' }] })],
        ping: { everyMs: 20_000, message: 'ping' },
        parse: m => {
            if (m.arg?.channel !== 'liquidation-orders' || !m.data) return [];
            return m.data.flatMap((d: any) => {
                const coin = coinFrom(d.instId);
                if (!coin) return [];
                return (d.details ?? []).map((x: any) => {
                    const price = +x.bkPx;
                    const qty = +x.sz * OKX_CT_VAL[coin];
                    const side: 'long' | 'short' = x.posSide === 'long' || x.posSide === 'short' ? x.posSide : x.side === 'sell' ? 'long' : 'short';
                    return { coin, liq: { exchange: 'okx' as const, side, price, qty, usd: price * qty, time: +x.ts } };
                });
            });
        },
    },
};

const connect = (ex: LiqExchange, attempt = 0) => {
    const src = SOURCES[ex];
    let ping: ReturnType<typeof setInterval> | undefined;
    const ws = new WebSocket(src.url);

    ws.onopen = () => {
        attempt = 0;
        connectedSince[ex] = connectedSince[ex] ?? Date.now();
        src.subscribe?.().forEach(msg => ws.send(msg));
        if (src.ping) ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(src.ping!.message), src.ping.everyMs);
        logger.info(`[liq] ${ex} connected`);
    };
    ws.onmessage = ev => {
        const text = typeof ev.data === 'string' ? ev.data : ev.data.toString();
        if (text === 'pong') return;
        try {
            src.parse(JSON.parse(text)).forEach(({ coin, liq }) => record(coin, liq));
        } catch { /* 제어 메시지 등 */ }
    };
    ws.onerror = () => { /* onclose에서 재연결 */ };
    ws.onclose = () => {
        if (ping) clearInterval(ping);
        connectedSince[ex] = null;
        const delay = Math.min(30_000, 2_000 * 2 ** attempt);
        logger.warn(`[liq] ${ex} disconnected, retry in ${delay / 1000}s`);
        setTimeout(() => connect(ex, attempt + 1), delay);
    };
};

let started = false;
export const startLiquidationAggregator = () => {
    if (started) return;
    started = true;
    LIQ_EXCHANGES.forEach(ex => connect(ex));
};

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------
export interface LiquidationSnapshot {
    coin: LiqCoin;
    now: number;
    /** 거래소별 수집 시작 시각 (null이면 연결 안 됨) */
    since: Record<LiqExchange, number | null>;
    /** 기간 -> 거래소 -> 롱/숏 청산 합계(USD) */
    windows: Record<string, Record<LiqExchange, { long: number; short: number }>>;
    recent: Liquidation[];
}

export const getLiquidations = (coin: LiqCoin, limit = 50): LiquidationSnapshot => {
    const now = Date.now();
    const windows: LiquidationSnapshot['windows'] = {};
    Object.entries(LIQ_WINDOWS).forEach(([key, ms]) => {
        const since = now - ms;
        const byEx = {} as Record<LiqExchange, { long: number; short: number }>;
        LIQ_EXCHANGES.forEach(ex => {
            let long = 0;
            let short = 0;
            for (const b of buckets[coin][ex]) {
                if (b.t >= since) { long += b.long; short += b.short; }
            }
            byEx[ex] = { long, short };
        });
        windows[key] = byEx;
    });
    return { coin, now, since: { ...connectedSince }, windows, recent: recent[coin].slice(0, limit) };
};
