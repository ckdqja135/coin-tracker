import logger from '../log/logger';

/**
 * 거래소 선물 실시간 체결 집계기 (롱/숏 페이지용)
 * - 서버가 켜져 있는 동안 4개 거래소의 BTC·ETH 체결을 계속 받는다.
 * - 1초 단위로 테이커 매수/매도 금액(USD)을 최근 4시간치 쌓아 두고,
 *   10만 달러 이상 대형 체결은 최근 것부터 일정 개수 보관한다.
 * - 그래서 브라우저가 페이지를 열자마자 기간별 합계와 최근 대형 체결을 바로 받을 수 있다.
 */

export type FlowExchange = 'binance' | 'bybit' | 'okx' | 'bitget';
export const FLOW_EXCHANGES: FlowExchange[] = ['binance', 'bybit', 'okx', 'bitget'];
export const FLOW_COINS = ['BTC', 'ETH'] as const;
export type FlowCoin = typeof FLOW_COINS[number];

export const FLOW_WINDOWS: Record<string, number> = {
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '30m': 30 * 60_000,
    '1h': 3600_000,
    '4h': 4 * 3600_000,
};

const KEEP_MS = 4 * 3600_000;
const BIG_TRADE_USD = 100_000;
const MAX_BIG_TRADES = 300;
const OKX_CT_VAL: Record<FlowCoin, number> = { BTC: 0.01, ETH: 0.1 };

export interface FlowTrade {
    exchange: FlowExchange;
    side: 'buy' | 'sell';
    price: number;
    qty: number;
    usd: number;
    time: number;
}

interface Bucket { t: number; buy: number; sell: number }

// coin -> exchange -> 1초 버킷
const buckets: Record<string, Record<FlowExchange, Bucket[]>> = {};
const bigTrades: Record<string, FlowTrade[]> = {};
// 거래소별 수집 시작(연결) 시각: 기간이 다 찼는지 판단하는 데 쓴다
const connectedSince: Record<FlowExchange, number | null> = { binance: null, bybit: null, okx: null, bitget: null };

FLOW_COINS.forEach(c => {
    buckets[c] = { binance: [], bybit: [], okx: [], bitget: [] };
    bigTrades[c] = [];
});

const record = (coin: FlowCoin, t: FlowTrade) => {
    if (!t.usd || !Number.isFinite(t.usd)) return;
    const list = buckets[coin][t.exchange];
    const sec = Math.floor(t.time / 1000) * 1000;
    let b = list[list.length - 1];
    if (!b || b.t !== sec) {
        b = { t: sec, buy: 0, sell: 0 };
        list.push(b);
        const cutoff = Date.now() - KEEP_MS;
        while (list.length && list[0].t < cutoff) list.shift();
    }
    if (t.side === 'buy') b.buy += t.usd; else b.sell += t.usd;

    if (t.usd >= BIG_TRADE_USD) {
        const arr = bigTrades[coin];
        arr.unshift(t);
        if (arr.length > MAX_BIG_TRADES) arr.length = MAX_BIG_TRADES;
    }
};

// ---------------------------------------------------------------------------
// 거래소별 연결 설정: 한 연결로 BTC·ETH를 함께 받는다
// ---------------------------------------------------------------------------
interface Source {
    url: string;
    subscribe?: () => string[];
    ping?: { everyMs: number; message: string };
    parse: (msg: any) => { coin: FlowCoin; trade: FlowTrade }[];
}

const coinFrom = (s: string): FlowCoin | null => {
    const u = s.toUpperCase();
    if (u.startsWith('BTC')) return 'BTC';
    if (u.startsWith('ETH')) return 'ETH';
    return null;
};

const SOURCES: Record<FlowExchange, Source> = {
    binance: {
        url: 'wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade',
        parse: m => {
            const d = m.data;
            if (d?.e !== 'aggTrade') return [];
            const coin = coinFrom(d.s);
            if (!coin) return [];
            const price = +d.p;
            const qty = +d.q;
            return [{ coin, trade: { exchange: 'binance', side: d.m ? 'sell' : 'buy', price, qty, usd: price * qty, time: d.T } }];
        },
    },
    bybit: {
        url: 'wss://stream.bybit.com/v5/public/linear',
        subscribe: () => [JSON.stringify({ op: 'subscribe', args: ['publicTrade.BTCUSDT', 'publicTrade.ETHUSDT'] })],
        ping: { everyMs: 20_000, message: '{"op":"ping"}' },
        parse: m => {
            if (!m.topic?.startsWith('publicTrade')) return [];
            return (m.data ?? []).flatMap((d: any) => {
                const coin = coinFrom(d.s);
                if (!coin) return [];
                const price = +d.p;
                const qty = +d.v;
                return [{ coin, trade: { exchange: 'bybit' as const, side: d.S === 'Buy' ? 'buy' as const : 'sell' as const, price, qty, usd: price * qty, time: +d.T } }];
            });
        },
    },
    okx: {
        url: 'wss://ws.okx.com:8443/ws/v5/public',
        subscribe: () => [JSON.stringify({ op: 'subscribe', args: [{ channel: 'trades', instId: 'BTC-USDT-SWAP' }, { channel: 'trades', instId: 'ETH-USDT-SWAP' }] })],
        ping: { everyMs: 20_000, message: 'ping' },
        parse: m => {
            if (m.arg?.channel !== 'trades' || !m.data) return [];
            return m.data.flatMap((d: any) => {
                const coin = coinFrom(d.instId);
                if (!coin) return [];
                const price = +d.px;
                const qty = +d.sz * OKX_CT_VAL[coin];
                return [{ coin, trade: { exchange: 'okx' as const, side: d.side === 'buy' ? 'buy' as const : 'sell' as const, price, qty, usd: price * qty, time: +d.ts } }];
            });
        },
    },
    bitget: {
        url: 'wss://ws.bitget.com/v2/ws/public',
        subscribe: () => [JSON.stringify({
            op: 'subscribe',
            args: ['BTCUSDT', 'ETHUSDT'].map(instId => ({ instType: 'USDT-FUTURES', channel: 'trade', instId })),
        })],
        ping: { everyMs: 20_000, message: 'ping' },
        parse: m => {
            // 구독 직후 snapshot은 과거 체결이라 건너뛴다
            if (m.arg?.channel !== 'trade' || m.action !== 'update') return [];
            const coin = coinFrom(m.arg.instId);
            if (!coin) return [];
            return (m.data ?? []).map((d: any) => {
                const price = +d.price;
                const qty = +d.size;
                return { coin, trade: { exchange: 'bitget' as const, side: d.side === 'buy' ? 'buy' as const : 'sell' as const, price, qty, usd: price * qty, time: +d.ts } };
            });
        },
    },
};

const connect = (ex: FlowExchange, attempt = 0) => {
    const src = SOURCES[ex];
    let ping: ReturnType<typeof setInterval> | undefined;
    const ws = new WebSocket(src.url);

    ws.onopen = () => {
        attempt = 0;
        connectedSince[ex] = connectedSince[ex] ?? Date.now();
        src.subscribe?.().forEach(msg => ws.send(msg));
        if (src.ping) ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(src.ping!.message), src.ping.everyMs);
        logger.info(`[flow] ${ex} connected`);
    };
    ws.onmessage = ev => {
        const text = typeof ev.data === 'string' ? ev.data : ev.data.toString();
        if (text === 'pong') return;
        try {
            src.parse(JSON.parse(text)).forEach(({ coin, trade }) => record(coin, trade));
        } catch { /* 제어 메시지 등 */ }
    };
    ws.onerror = () => { /* onclose에서 재연결 */ };
    ws.onclose = () => {
        if (ping) clearInterval(ping);
        // 끊긴 동안은 집계가 비므로 수집 시작 시각을 다시 잡는다
        connectedSince[ex] = null;
        const delay = Math.min(30_000, 2_000 * 2 ** attempt);
        logger.warn(`[flow] ${ex} disconnected, retry in ${delay / 1000}s`);
        setTimeout(() => connect(ex, attempt + 1), delay);
    };
};

let started = false;
export const startTradeAggregator = () => {
    if (started) return;
    started = true;
    FLOW_EXCHANGES.forEach(ex => connect(ex));
};

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------
export interface FlowSnapshot {
    coin: FlowCoin;
    now: number;
    /** 거래소별 수집 시작 시각 (null이면 연결 안 됨) */
    since: Record<FlowExchange, number | null>;
    /** 기간 -> 거래소 -> 매수/매도 합계(USD) */
    windows: Record<string, Record<FlowExchange, { buy: number; sell: number }>>;
    bigTrades: FlowTrade[];
}

export const getFlow = (coin: FlowCoin, bigLimit = 100): FlowSnapshot => {
    const now = Date.now();
    const windows: FlowSnapshot['windows'] = {};
    Object.entries(FLOW_WINDOWS).forEach(([key, ms]) => {
        const since = now - ms;
        const byEx = {} as Record<FlowExchange, { buy: number; sell: number }>;
        FLOW_EXCHANGES.forEach(ex => {
            let buy = 0;
            let sell = 0;
            for (const b of buckets[coin][ex]) {
                if (b.t >= since) { buy += b.buy; sell += b.sell; }
            }
            byEx[ex] = { buy, sell };
        });
        windows[key] = byEx;
    });
    return { coin, now, since: { ...connectedSince }, windows, bigTrades: bigTrades[coin].slice(0, bigLimit) };
};
