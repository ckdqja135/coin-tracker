import { useEffect, useRef, useState } from 'react';

export type FeedExchange = 'bitget' | 'binance' | 'bybit' | 'okx';

export interface FeedTrade {
  id: string;
  exchange: FeedExchange;
  side: 'buy' | 'sell';
  price: number;
  qty: number; // 코인 수량
  usd: number;
  time: number;
}

/** 초 단위 매수/매도 체결 대금 (게이지 집계용) */
interface Bucket { t: number; buy: number; sell: number; }

const OKX_CT_VAL: Record<string, number> = { BTC: 0.01, ETH: 0.1 };
const KEEP_MS = 4 * 3600_000;
const MAX_BIG = 300;

type Handler = (t: Omit<FeedTrade, 'id'>) => void;

interface Source {
  url: (coin: string) => string;
  subscribe?: (ws: WebSocket, coin: string) => void;
  parse: (msg: any, coin: string, emit: Handler) => void;
}

const SOURCES: Record<FeedExchange, Source> = {
  binance: {
    url: c => `wss://fstream.binance.com/market/ws/${c.toLowerCase()}usdt@aggTrade`,
    parse: (m, _c, emit) => {
      if (m.e !== 'aggTrade') return;
      const price = +m.p;
      const qty = +m.q;
      emit({ exchange: 'binance', side: m.m ? 'sell' : 'buy', price, qty, usd: price * qty, time: m.T });
    },
  },
  bybit: {
    url: () => 'wss://stream.bybit.com/v5/public/linear',
    subscribe: (ws, c) => ws.send(JSON.stringify({ op: 'subscribe', args: [`publicTrade.${c}USDT`] })),
    parse: (m, _c, emit) => {
      if (!m.topic?.startsWith('publicTrade')) return;
      for (const d of m.data) {
        const price = +d.p;
        const qty = +d.v;
        emit({ exchange: 'bybit', side: d.S === 'Buy' ? 'buy' : 'sell', price, qty, usd: price * qty, time: d.T });
      }
    },
  },
  okx: {
    url: () => 'wss://ws.okx.com:8443/ws/v5/public',
    subscribe: (ws, c) => ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'trades', instId: `${c}-USDT-SWAP` }] })),
    parse: (m, c, emit) => {
      if (m.arg?.channel !== 'trades' || !m.data) return;
      for (const d of m.data) {
        const price = +d.px;
        const qty = +d.sz * (OKX_CT_VAL[c] ?? 1);
        emit({ exchange: 'okx', side: d.side === 'buy' ? 'buy' : 'sell', price, qty, usd: price * qty, time: +d.ts });
      }
    },
  },
  // BitMEX 선물은 2026-09 정산 이후 체결이 없어 Bitget으로 대체
  bitget: {
    url: () => 'wss://ws.bitget.com/v2/ws/public',
    subscribe: (ws, c) => ws.send(JSON.stringify({ op: 'subscribe', args: [{ instType: 'USDT-FUTURES', channel: 'trade', instId: `${c}USDT` }] })),
    parse: (m, _c, emit) => {
      // 구독 직후 snapshot은 과거 체결이므로 무시
      if (m.arg?.channel !== 'trade' || m.action !== 'update') return;
      for (const d of m.data) {
        const price = +d.price;
        const qty = +d.size;
        emit({ exchange: 'bitget', side: d.side === 'buy' ? 'buy' : 'sell', price, qty, usd: price * qty, time: +d.ts });
      }
    },
  },
};

export const FEED_EXCHANGES: FeedExchange[] = ['binance', 'bybit', 'okx', 'bitget'];

/**
 * 4개 거래소 선물 체결 실시간 수신
 * - minUsd 이상 체결은 목록으로 유지
 * - 전체 체결은 초 단위 매수/매도 대금으로 집계해 기간별 롱/숏 비율 계산에 쓴다
 */
export const useTradeFeed = (coin: string, minUsd: number, paused: boolean, onBigTrade?: (t: FeedTrade) => void) => {
  const [bigTrades, setBigTrades] = useState<FeedTrade[]>([]);
  const [connected, setConnected] = useState<Record<FeedExchange, boolean>>({ bitget: false, binance: false, bybit: false, okx: false });
  const buckets = useRef<Record<FeedExchange, Bucket[]>>({ bitget: [], binance: [], bybit: [], okx: [] });
  const minRef = useRef(minUsd);
  const pausedRef = useRef(paused);
  const cbRef = useRef(onBigTrade);
  minRef.current = minUsd;
  pausedRef.current = paused;
  cbRef.current = onBigTrade;

  useEffect(() => {
    setBigTrades([]);
    buckets.current = { bitget: [], binance: [], bybit: [], okx: [] };
    let seq = 0;
    let closed = false;
    const sockets: WebSocket[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const emit: Handler = t => {
      if (!t.usd || !Number.isFinite(t.usd)) return;
      const list = buckets.current[t.exchange];
      const sec = Math.floor(t.time / 1000) * 1000;
      let b = list[list.length - 1];
      if (!b || b.t !== sec) {
        b = { t: sec, buy: 0, sell: 0 };
        list.push(b);
        while (list.length && list[0].t < Date.now() - KEEP_MS) list.shift();
      }
      if (t.side === 'buy') b.buy += t.usd; else b.sell += t.usd;

      if (t.usd >= minRef.current && !pausedRef.current) {
        const trade: FeedTrade = { ...t, id: `${t.exchange}-${t.time}-${seq++}` };
        setBigTrades(prev => [trade, ...prev].slice(0, MAX_BIG));
        cbRef.current?.(trade);
      }
    };

    const connect = (ex: FeedExchange) => {
      if (closed) return;
      const src = SOURCES[ex];
      const ws = new WebSocket(src.url(coin));
      sockets.push(ws);
      let ping: ReturnType<typeof setInterval> | undefined;
      ws.onopen = () => {
        setConnected(c => ({ ...c, [ex]: true }));
        src.subscribe?.(ws, coin);
        // bybit/okx는 주기적인 ping이 없으면 연결을 끊는다
        if (ex === 'bybit') ping = setInterval(() => ws.readyState === 1 && ws.send('{"op":"ping"}'), 20_000);
        if (ex === 'okx' || ex === 'bitget') ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 20_000);
      };
      ws.onmessage = ev => {
        if (ev.data === 'pong') return;
        try { src.parse(JSON.parse(ev.data), coin, emit); } catch { /* 형식이 다른 제어 메시지 */ }
      };
      ws.onclose = () => {
        if (ping) clearInterval(ping);
        setConnected(c => ({ ...c, [ex]: false }));
        if (!closed) timers.push(setTimeout(() => connect(ex), 3000));
      };
    };
    FEED_EXCHANGES.forEach(connect);

    return () => {
      closed = true;
      timers.forEach(clearTimeout);
      sockets.forEach(ws => ws.close());
    };
  }, [coin]);

  /** 최근 windowMs 동안 거래소별 매수/매도 대금 */
  const volume = (ex: FeedExchange, windowMs: number) => {
    const since = Date.now() - windowMs;
    let buy = 0;
    let sell = 0;
    for (const b of buckets.current[ex]) {
      if (b.t >= since) { buy += b.buy; sell += b.sell; }
    }
    return { buy, sell };
  };

  return { bigTrades, connected, volume };
};
