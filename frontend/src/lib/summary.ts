import type { ExchangeTickers, Notice, NoticeExchange, TickerExchange } from '../services/market';
import { EXCHANGES, exchangeMeta } from './exchanges';
import { REF, relVsRef } from './vsRef';

/**
 * 코인·시장 요약: 이미 받고 있는 시세와 거래소 공지만으로 규칙에 따라 눈에 띄는 사실을 골라 낸다.
 * 문장은 화면에서 번역 키(key)와 값(vars)으로 만든다.
 */
export type Tone = 'up' | 'down' | 'warn' | 'info' | 'muted';
export interface Fact {
  key: string;
  vars?: Record<string, string>;
  tone: Tone;
  /** 크게 강조할 사실 (거래지원 종료, 유의 종목, 큰 김프 등) */
  strong?: boolean;
}

const DAY = 86_400_000;
/** 거래지원 종료·유의 종목 공지를 요약에 띄우는 기간 */
export const RISK_FOR_MS = 30 * DAY;
export const NEW_FOR_MS = 7 * DAY;
/** 김프가 이 이상(절댓값)이면 강조한다 */
export const KIMP_ALERT = 3;
/** 국내 거래소끼리 가격 차가 이 이상이면 알려 준다 */
export const GAP_ALERT = 1;

export const signed = (v: number, digits = 2) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;
const toneOf = (v: number): Tone => (v > 0 ? 'up' : v < 0 ? 'down' : 'muted');
const exLabel = (e: NoticeExchange | TickerExchange) => exchangeMeta(e).label;
const dateOf = (t: number) => {
  // 한국시간 월/일
  const d = new Date(t + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

type Tickers = Partial<Record<TickerExchange, ExchangeTickers>>;

/** 거래소별로 묶은 공지 사실 (같은 내용이 두 거래소에 있으면 한 줄로) */
const noticeFact = (list: Notice[], key: string, tone: Tone, strong: boolean, extra?: Record<string, string>): Fact | null => {
  if (!list.length) return null;
  const exs = Array.from(new Set(list.map(n => n.exchange)));
  const time = Math.max(...list.map(n => n.time));
  return { key, tone, strong, vars: { ex: exs.map(exLabel).join(' · '), date: dateOf(time), ...extra } };
};

/** 유의 종목 지정 공지 중 이후에 같은 거래소에서 "해제" 공지가 나오지 않은 것 */
const activeWarnings = (notices: Notice[], coin: string, now: number) =>
  notices.filter(n => n.kind === 'warning' && n.coins.includes(coin) && now - n.time < RISK_FOR_MS
    && !notices.some(m => m.exchange === n.exchange && m.coins.includes(coin) && m.time > n.time && /해제/.test(m.title)));

export interface CoinSummaryInput {
  coin: string;
  /** 등락률·BTC 대비를 볼 기준 거래소 */
  base: TickerExchange;
  tickers: Tickers;
  notices: Notice[];
  now?: number;
}

/** 코인 하나의 요약 사실 (중요한 순서) */
export const summarizeCoin = ({ coin, base, tickers, notices, now = Date.now() }: CoinSummaryInput): Fact[] => {
  const facts: Fact[] = [];
  const push = (f: Fact | null) => { if (f) facts.push(f); };
  const mine = notices.filter(n => n.coins.includes(coin));

  // 1. 공지: 거래지원 종료 > 유의 종목 > 신규 상장
  push(noticeFact(mine.filter(n => n.kind === 'delisting' && now - n.time < RISK_FOR_MS), 'sum.delisting', 'down', true));
  push(noticeFact(activeWarnings(notices, coin, now), 'sum.warning', 'warn', true));
  const listings = mine.filter(n => n.kind === 'listing' && now - n.time < NEW_FOR_MS);
  if (listings.length) {
    const first = Math.min(...listings.map(n => n.time));
    push(noticeFact(listings, 'sum.new', 'warn', false, { days: String(Math.floor((now - first) / DAY) + 1) }));
  }

  // 2. 기준 거래소의 24시간 등락과 BTC 대비
  const baseData = tickers[base]?.data;
  const own = baseData?.[coin];
  if (own?.change24h != null) {
    // 업비트 등락률은 09:00 KST 기준, 나머지는 최근 24시간 기준
    push({ key: base === 'upbit' ? 'sum.changeToday' : 'sum.change', tone: toneOf(own.change24h), vars: { ex: exLabel(base), v: signed(own.change24h) } });
    const ref = baseData?.[REF]?.change24h;
    if (coin !== REF && ref != null) {
      const rel = relVsRef(own.change24h, ref);
      push({ key: 'sum.vsBtc', tone: toneOf(rel), vars: { v: signed(rel) } });
    }
  }

  // 3. 24시간 고가·저가 근처 (범위가 너무 좁으면 의미가 없어 뺀다)
  if (own && own.high != null && own.low != null && own.low > 0 && own.high / own.low > 1.02) {
    if (own.price >= own.high * 0.99) push({ key: 'sum.nearHigh', tone: 'up' });
    else if (own.price <= own.low * 1.01) push({ key: 'sum.nearLow', tone: 'down' });
  }

  // 4. 김프: 국내 기준 거래소(해외 거래소가 기준이면 업비트) vs 바이낸스(없으면 게이트)
  const krw = exchangeMeta(base).currency === 'KRW' ? base : 'upbit';
  const krwPrice = tickers[krw]?.data[coin]?.price;
  const foreign = (['binance', 'gateio'] as TickerExchange[]).find(e => tickers[e]?.data[coin]);
  const fx = Object.values(tickers).find(x => x?.usdKrw)?.usdKrw ?? null;
  if (krwPrice && foreign && fx) {
    const kimp = (krwPrice / fx / tickers[foreign]!.data[coin].price - 1) * 100;
    const big = Math.abs(kimp) >= KIMP_ALERT;
    push({ key: 'sum.kimp', tone: big ? 'warn' : 'muted', strong: big, vars: { ex: exLabel(krw), vs: exLabel(foreign), v: signed(kimp) } });
  }

  // 5. 국내 거래소끼리 가격 차
  const krwPrices = EXCHANGES.filter(e => e.currency === 'KRW')
    .map(e => ({ id: e.id, p: tickers[e.id]?.data[coin]?.price }))
    .filter((x): x is { id: TickerExchange; p: number } => !!x.p);
  if (krwPrices.length >= 2) {
    const hi = krwPrices.reduce((a, b) => (b.p > a.p ? b : a));
    const lo = krwPrices.reduce((a, b) => (b.p < a.p ? b : a));
    const gap = (hi.p / lo.p - 1) * 100;
    if (gap >= GAP_ALERT) push({ key: 'sum.gap', tone: 'warn', vars: { hi: exLabel(hi.id), lo: exLabel(lo.id), v: gap.toFixed(2) } });
  }

  // 6. 상장 범위 (시세를 다 받은 뒤에만 판단한다)
  if (EXCHANGES.every(e => tickers[e.id])) {
    const on = EXCHANGES.filter(e => tickers[e.id]!.data[coin]);
    const krwOn = on.filter(e => e.currency === 'KRW');
    if (on.length && !krwOn.length) push({ key: 'sum.foreignOnly', tone: 'muted' });
    else if (krwOn.length && krwOn.length === on.length) push({ key: 'sum.krwOnly', tone: 'muted' });
  }

  return facts;
};

export interface Mover { coin: string; change: number }
export interface MarketSummary {
  btc: number | null;
  up: number;
  down: number;
  gainers: Mover[];
  losers: Mover[];
  /** 최근 24시간 공지 */
  listings: string[];
  warnings: string[];
  delistings: string[];
}

const recentCoins = (notices: Notice[], kind: Notice['kind'], now: number) =>
  Array.from(new Set(notices.filter(n => n.kind === kind && now - n.time < DAY).flatMap(n => n.coins)));

/** 업비트 원화마켓 전체 시세와 공지로 오늘 시장 요약을 만든다 */
export const summarizeMarket = (upbit: ExchangeTickers | null | undefined, notices: Notice[], now = Date.now(), top = 3): MarketSummary => {
  const rows = Object.entries(upbit?.data ?? {})
    .filter(([, t]) => t.change24h != null)
    .map(([coin, t]) => ({ coin, change: t.change24h as number }));
  const sorted = [...rows].sort((a, b) => b.change - a.change);
  return {
    btc: upbit?.data[REF]?.change24h ?? null,
    up: rows.filter(r => r.change > 0).length,
    down: rows.filter(r => r.change < 0).length,
    gainers: sorted.slice(0, top).filter(r => r.change > 0),
    losers: sorted.slice(-top).reverse().filter(r => r.change < 0),
    listings: recentCoins(notices, 'listing', now),
    warnings: recentCoins(notices, 'warning', now),
    delistings: recentCoins(notices, 'delisting', now),
  };
};
