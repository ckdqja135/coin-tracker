import { useEffect, useRef, useState } from 'react';
import { FlowSnapshot, fetchFlow } from '../services/market';

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

/** 같은 체결인지 판단하는 키 (서버·브라우저에서 같은 값으로 계산된다) */
const tradeKey = (t: { exchange: string; time: number; price: number; qty: number }) =>
  `${t.exchange}|${t.time}|${t.price}|${t.qty.toFixed(6)}`;

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
  // 서버가 모아 둔 기간별 합계·최근 대형 체결 (페이지를 열자마자 기간이 채워져 있다)
  const [server, setServer] = useState<FlowSnapshot | null>(null);
  // 서버 체결과 실시간 체결이 겹치지 않도록 이미 넣은 체결을 기억한다
  const seen = useRef<Set<string>>(new Set());
  const buckets = useRef<Record<FeedExchange, Bucket[]>>({ bitget: [], binance: [], bybit: [], okx: [] });
  const minRef = useRef(minUsd);
  const pausedRef = useRef(paused);
  const cbRef = useRef(onBigTrade);
  minRef.current = minUsd;
  pausedRef.current = paused;
  cbRef.current = onBigTrade;

  useEffect(() => {
    setBigTrades([]);
    setServer(null);
    seen.current = new Set();
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

      const key = tradeKey(t);
      if (t.usd >= minRef.current && !pausedRef.current && !seen.current.has(key)) {
        seen.current.add(key);
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

    // 서버 집계: 3초마다 받는다. 대형 체결은 아직 없는 것만 목록에 보탠다 (알림음은 울리지 않음)
    const pollServer = () => {
      fetchFlow(coin)
        .then(snap => {
          if (closed) return;
          setServer(snap);
          if (pausedRef.current) return;
          const fresh: FeedTrade[] = [];
          snap.bigTrades.forEach(t => {
            const key = tradeKey(t);
            if (t.usd < minRef.current || seen.current.has(key)) return;
            seen.current.add(key);
            fresh.push({ ...t, id: `srv-${key}` });
          });
          if (fresh.length) {
            setBigTrades(prev => [...prev, ...fresh].sort((a, b) => b.time - a.time).slice(0, MAX_BIG));
          }
        })
        .catch(() => { /* 서버 집계가 없으면 브라우저 집계만 쓴다 */ });
    };
    pollServer();
    const poll = setInterval(pollServer, 3000);

    return () => {
      closed = true;
      clearInterval(poll);
      timers.forEach(clearTimeout);
      sockets.forEach(ws => ws.close());
    };
  }, [coin]);

  /**
   * 최근 기간 동안 거래소별 매수/매도 대금.
   * 서버 집계가 있으면 그것을 쓰고(페이지를 연 시점과 무관), 없으면 브라우저가 모은 값으로 계산한다.
   */
  const volume = (ex: FeedExchange, windowKey: string, windowMs: number) => {
    const fromServer = server?.windows[windowKey]?.[ex];
    if (fromServer) return fromServer;
    const since = Date.now() - windowMs;
    let buy = 0;
    let sell = 0;
    for (const b of buckets.current[ex]) {
      if (b.t >= since) { buy += b.buy; sell += b.sell; }
    }
    return { buy, sell };
  };

  /** 이 기간을 다 채울 만큼 모였는지, 아니면 몇 분째 모으는 중인지 (null이면 다 참) */
  const collectingMinutes = (ex: FeedExchange, windowMs: number): number | null => {
    const since = server?.since[ex];
    if (!server || !since) return null;
    const elapsed = server.now - since;
    return elapsed >= windowMs ? null : Math.floor(elapsed / 60_000);
  };

  return { bigTrades, connected, volume, collectingMinutes };
};
