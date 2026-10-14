import { Candle, Interval } from '../services/market';

const MIN = 60_000;
const DAY = 86_400_000;
export const INTERVAL_MS: Record<Interval, number> = {
  '1m': MIN, '5m': 5 * MIN, '30m': 30 * MIN, '1h': 60 * MIN, '4h': 240 * MIN, '1d': DAY, '1w': 7 * DAY, '1M': 30 * DAY,
};

export const sma = (points: [number, number][], period: number): [number, number][] => {
  if (period <= 1) return points;
  const out: [number, number][] = [];
  let sum = 0;
  points.forEach(([t, v], i) => {
    sum += v;
    if (i >= period) sum -= points[i - period][1];
    if (i >= period - 1) out.push([t, sum / period]);
  });
  return out;
};

/** 타임스탬프 기준으로 정렬된 두 종가 시계열의 로그수익률 피어슨 상관계수 */
export const correlation = (a: Candle[], b: Candle[]): { r: number | null; n: number } => {
  const bMap = new Map(b.map(k => [k.t, k.c]));
  const pairs: [number, number][] = [];
  a.forEach(k => {
    const v = bMap.get(k.t);
    if (v != null && v > 0 && k.c > 0) pairs.push([k.c, v]);
  });
  const ra: number[] = [];
  const rb: number[] = [];
  for (let i = 1; i < pairs.length; i++) {
    ra.push(Math.log(pairs[i][0] / pairs[i - 1][0]));
    rb.push(Math.log(pairs[i][1] / pairs[i - 1][1]));
  }
  const n = ra.length;
  if (n < 10) return { r: null, n };
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb) ** 2;
  }
  if (va === 0 || vb === 0) return { r: null, n };
  return { r: cov / Math.sqrt(va * vb), n };
};

export const downloadCsv = (filename: string, header: string[], rows: (string | number | null)[][]) => {
  const escape = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const formatTime = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const fmtCompact = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return '-';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(2);
};

export const fmtPrice = (v: number | null | undefined, currency: 'USD' | 'KRW' = 'USD') => {
  if (v == null || !Number.isFinite(v)) return '-';
  if (currency === 'KRW') return `₩${Math.round(v).toLocaleString('en-US')}`;
  const digits = v >= 1000 ? 2 : v >= 1 ? 3 : 6;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits })}`;
};

/** localStorage 접근은 사파리 프라이빗 모드 등에서 예외가 날 수 있다 */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

/**
 * [start, end] 구간만 남기되, 장이 닫혀 데이터가 없는 구간은 직전 값으로 평평하게 이어 그린다
 * (지수·원자재처럼 거래 시간이 정해진 자산용). 데이터가 다시 생기는 지점에서 꺾이므로 사선이 생기지 않는다.
 */
export const fillRange = <T extends { t: number; v: number }>(points: T[], start: number, end: number): { t: number; v: number }[] => {
  const before = points.filter(p => p.t < start);
  const inside = points.filter(p => p.t >= start && p.t <= end).map(p => ({ t: p.t, v: p.v }));
  const carry = before[before.length - 1];
  if (carry && (!inside.length || inside[0].t > start)) inside.unshift({ t: start, v: carry.v });

  // 평소 간격(가장 짧은 간격)의 3배보다 벌어진 곳은 휴장으로 보고, 다음 점 직전까지 이전 값을 유지한다
  let step = Infinity;
  for (let i = 1; i < inside.length; i++) {
    const d = inside[i].t - inside[i - 1].t;
    if (d > 0 && d < step) step = d;
  }
  const out: { t: number; v: number }[] = [];
  inside.forEach((p, i) => {
    const prev = out[out.length - 1];
    if (i > 0 && prev && Number.isFinite(step) && p.t - prev.t > step * 3) out.push({ t: p.t - 1, v: prev.v });
    out.push(p);
  });

  const last = out[out.length - 1];
  if (last && last.t < end) out.push({ t: end, v: last.v });
  return out;
};
