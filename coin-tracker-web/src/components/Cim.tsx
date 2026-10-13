import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import ExchangeBadge from './ExchangeBadge';
import { useI18n } from '../i18n';
import { ExchangeMeta, klineOf } from '../lib/exchanges';
import { DOWN, REF, UP, relVsRef } from '../lib/vsRef';
import { ExchangeTickers, fetchKlinesSince } from '../services/market';

const COLORS = ['#3d6cf4', '#f7931a', '#26a69a', '#ab47bc', '#ef5350', '#00acc1', '#8d6e63', '#ec407a', '#7cb342', '#5c6bc0'];
const DAY = 86_400_000;
const MIN = 60_000;

/** 한국시간 09:00(= UTC 00:00) 기준 하루 시작 */
const dayStartOf = (t: number) => Math.floor(t / DAY) * DAY;

interface Props {
  exchange: ExchangeMeta;
  coins: string[];
  tickers: ExchangeTickers | undefined;
  currency: 'USD' | 'KRW';
  /** 값이 바뀌면 오늘 데이터를 다시 불러온다 (새로고침 버튼) */
  resetKey: number;
}

/** 코인별 기록: base = 09:00 시가, points = 1분 단위 [시각, 등락률%] */
type Series = { base: number; points: [number, number][] };

/**
 * Coin Impulse Monitor
 * 기준 거래소에서 한국시간 09:00 시가 대비 선택 코인들의 등락률을 1분 단위로 겹쳐 그린다.
 * 과거는 실제 1분봉(1분마다 다시 받음), 진행 중인 1분은 실시간 시세, 미래 구간은 현재 값으로 평평한 점선. 매일 09:00에 초기화된다.
 */
const Cim: React.FC<Props> = ({ exchange, coins, tickers, currency, resetKey }) => {
  const theme = useTheme();
  const { lang, t } = useI18n();
  const history = useRef<Map<string, Series>>(new Map());
  const [version, setVersion] = useState(0);
  const [dayStart, setDayStart] = useState(() => dayStartOf(Date.now()));
  const [loading, setLoading] = useState(false);
  // 백필 실패(거래소 호출 제한 등) 시 다시 시도하기 위한 카운터
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);

  // 09:00 KST가 지나면 새 날로 초기화
  useEffect(() => {
    const id = setInterval(() => {
      const d = dayStartOf(Date.now());
      setDayStart(prev => (prev === d ? prev : d));
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  // 거래소 / 날짜 / 새로고침이 바뀌면 전부 비우고 다시 채운다
  useEffect(() => {
    generation.current += 1;
    history.current = new Map();
    setVersion(v => v + 1);
  }, [exchange.id, dayStart, resetKey]);

  // 과거 구간은 항상 실제 1분봉으로 그린다.
  // 처음에 09:00부터 받고, 이후 1분마다 다시 받아 덮어쓴다 (서버는 마지막 캔들 이후만 새로 받는다).
  // 실시간 시세는 "지금 진행 중인 1분"의 값만 갱신한다.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRefreshTick(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // 알트코인은 BTC 대비 상대 등락률로 그리므로, BTC는 선택하지 않아도 기준으로 항상 받는다
  const tracked = useMemo(() => Array.from(new Set([REF, ...coins])), [coins]);
  const coinKey = tracked.join(',');
  // 차트 옵션은 "선택한" 코인 기준이다 (BTC 선택/해제는 tracked를 바꾸지 않으므로 따로 둔다)
  const selKey = coins.join(',');
  useEffect(() => {
    const gen = generation.current;
    // 선택 해제된 코인 제거
    Array.from(history.current.keys()).forEach(c => { if (!tracked.includes(c)) history.current.delete(c); });
    const missing = tracked.some(c => !history.current.has(c));
    if (missing) setLoading(true);
    let failed = false;
    Promise.all(tracked.map(async c => {
      const { source, symbol } = klineOf(exchange, c);
      try {
        const candles = await fetchKlinesSince(source, symbol, '1m', dayStart);
        if (gen !== generation.current || !candles.length) return;
        const base = candles[0].o;
        const points: [number, number][] = [[dayStart, 0]];
        candles.forEach(k => points.push([k.t + MIN, (k.c / base - 1) * 100]));
        history.current.set(c, { base, points });
      } catch {
        if (!history.current.has(c)) failed = true;
      }
    })).finally(() => {
      if (gen === generation.current) {
        setLoading(false);
        setVersion(v => v + 1);
        // 받지 못한 코인은 잠시 뒤 다시 받는다 (그동안 엉뚱한 기준가로 그리지 않음)
        if (failed) setTimeout(() => { if (gen === generation.current) setRetry(n => n + 1); }, 5000);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinKey, exchange.id, dayStart, resetKey, retry, refreshTick]);

  // 실시간 시세: 현재 분의 점을 갱신하거나 바로 다음 분의 점을 추가.
  // 사이에 빠진 분이 있으면 직선으로 잇지 않고 1분봉을 다시 받는다.
  useEffect(() => {
    if (!tickers || tickers.exchange !== exchange.id || loading) return;
    const now = Date.now();
    if (dayStartOf(now) !== dayStart) return;
    const minuteEnd = Math.floor(now / MIN) * MIN + MIN;
    let gap = false;
    tracked.forEach(c => {
      const tk = tickers.data[c];
      const s = history.current.get(c);
      if (!tk || !s) return;
      const pct = (tk.price / s.base - 1) * 100;
      const last = s.points[s.points.length - 1];
      if (last[0] === minuteEnd) last[1] = pct;
      else if (last[0] === minuteEnd - MIN) s.points.push([minuteEnd, pct]);
      else if (last[0] < minuteEnd - MIN) gap = true;
    });
    if (gap) setRefreshTick(n => n + 1);
    else setVersion(v => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers]);

  const fx = tickers?.usdKrw ?? null;
  const toDisplay = (p: number) => {
    if (exchange.currency === currency || !fx) return p;
    return currency === 'KRW' ? p * fx : p / fx;
  };
  const fmt = (p: number) => currency === 'KRW'
    ? `₩ ${Math.round(p).toLocaleString('en-US')}`
    : `$ ${p.toLocaleString('en-US', { maximumFractionDigits: p >= 100 ? 0 : p >= 1 ? 3 : 6 })}`;

  const options = useMemo<Highcharts.Options>(() => {
    const now = Date.now();
    const text = theme.palette.text.secondary;
    const grid = theme.palette.mode === 'dark' ? '#2a2f38' : '#eef0f4';

    const xMax = Math.max(now + 60 * MIN, dayStart + 10 * 3600_000);

    // 같은 시각의 BTC 등락률로 나눠 BTC 대비 상대 등락률을 구한다
    const refPts = history.current.get(REF)?.points ?? [];
    const refAt = new Map(refPts.map(([t, v]) => [t, v]));
    const displayPoints = (c: string): [number, number][] => {
      if (c === REF) return refPts.map(([t]) => [t, 0]); // BTC = 기준선 (현재까지만)
      if (!refPts.length) return []; // BTC 기록이 없으면 상대값을 구할 수 없다
      const pts = history.current.get(c)?.points ?? [];
      const out: [number, number][] = [];
      // 같은 시각의 BTC 점이 없으면(체결 없는 분, BTC 재요청 실패, 실시간 점 누락 등) 그 이전 마지막 BTC 값을 쓴다
      let j = 0;
      pts.forEach(([t, v]) => {
        while (j + 1 < refPts.length && refPts[j + 1][0] <= t) j++;
        if (refPts[j][0] > t) return;
        const b = refPts[j][1];
        out.push([t, relVsRef(v, b)]);
      });
      return out;
    };
    const shown = new Map(coins.map(c => [c, displayPoints(c)]));

    const series: Highcharts.SeriesLineOptions[] = coins.map((c, i) => {
      const pts = shown.get(c) ?? [];
      const raw = history.current.get(c)?.points ?? [];
      // 범례 %: BTC는 자신의 09:00 대비 등락률, 알트는 BTC 대비 상대 등락률
      const lastPct = c === REF ? raw[raw.length - 1]?.[1] : pts[pts.length - 1]?.[1];
      const price = tickers?.data[c]?.price;
      const color = COLORS[i % COLORS.length];
      return {
        type: 'line',
        id: c,
        name: exchange.market(c),
        color,
        lineWidth: 1.5,
        // 업데이트 시 이전 점의 옵션이 병합되어 남지 않도록 점마다 라벨/마커 여부를 명시
        // BTC는 미래 점선이 없으므로 선 끝(현재 시점)에 바로 라벨을 단다
        data: pts.map(([x, y], idx) => {
          const last = idx === pts.length - 1;
          return { x, y, marker: { enabled: last, radius: 4 }, dataLabels: { enabled: last && c === REF } };
        }),
        dataLabels: {
          enabled: false,
          allowOverlap: true,
          format: '{series.name}',
          align: 'left',
          verticalAlign: 'middle',
          x: 6,
          overflow: 'allow',
          crop: false,
          backgroundColor: color,
          borderRadius: 3,
          padding: 2,
          style: { color: '#fff', fontSize: '10px', fontWeight: '700', textOutline: 'none' },
        },
        custom: { pct: lastPct, price: price != null ? fmt(toDisplay(price)) : '-', isRef: c === REF },
      };
    });

    // 미래 구간: 현재 값에서 차트 오른쪽 끝까지 점선으로 평평하게 잇고, 끝에 마켓 이름 라벨을 단다
    const future: Highcharts.SeriesLineOptions[] = coins.flatMap((c, i) => {
      if (c === REF) return []; // BTC 기준선은 현재 시각까지만 긋는다
      const pts = shown.get(c) ?? [];
      const last = pts[pts.length - 1];
      if (!last || last[0] >= xMax) return [];
      const color = COLORS[i % COLORS.length];
      return [{
        name: exchange.market(c),
        type: 'line' as const,
        id: `${c}-future`,
        linkedTo: c,
        color,
        dashStyle: 'ShortDot' as const,
        lineWidth: 1,
        opacity: 0.7,
        enableMouseTracking: false,
        showInLegend: false,
        data: [
          { x: last[0], y: last[1], dataLabels: { enabled: false } },
          { x: xMax, y: last[1], dataLabels: { enabled: true } },
        ],
        dataLabels: {
          enabled: false,
          allowOverlap: true,
          format: '{series.name}',
          align: 'left',
          verticalAlign: 'middle',
          x: 4,
          // 플롯 영역 안으로 밀어 넣지 않고 오른쪽 여백으로 넘겨, 점선 끝 오른쪽에 붙인다
          overflow: 'allow',
          crop: false,
          backgroundColor: color,
          borderRadius: 3,
          padding: 2,
          style: { color: '#fff', fontSize: '10px', fontWeight: '700', textOutline: 'none' },
        },
      }];
    });

    return {
      chart: {
        backgroundColor: 'transparent', height: 520, animation: false, spacing: [10, 70, 10, 10], style: { fontFamily: 'inherit' },
        events: {
          // 등락률이 비슷하면 선 끝 라벨이 겹쳐 하나가 가려지므로, 위에서부터 차례로 겹치지 않게 아래로 민다
          render(this: Highcharts.Chart) {
            // BTC 라벨은 오른쪽 끝이 아니라 현재 시각에 붙으므로, 오른쪽 끝 라벨끼리만 쌓는다
            const labels = this.series
              .filter(sr => sr.options.id !== REF)
              .map(sr => sr.points[sr.points.length - 1] as any)
              .filter(pt => pt?.dataLabel?.visibility !== 'hidden' && pt?.dataLabel)
              .map(pt => pt.dataLabel)
              .map(lb => ({ lb, y: lb.alignAttr?.y ?? lb.translateY ?? 0, h: lb.height || 16 }))
              .sort((a, b) => a.y - b.y);
            let bottom = -Infinity;
            labels.forEach(item => {
              const y = Math.max(item.y, bottom + 2);
              if (y !== item.lb.translateY) item.lb.attr({ translateY: y });
              bottom = y + item.h;
            });
          },
        },
      },
      title: { text: undefined },
      credits: { enabled: false },
      exporting: { enabled: false },
      legend: {
        enabled: true,
        // 범례를 차트 위쪽에 한 줄에 하나씩 쌓아, 그래프와 x축이 차트 폭 전체를 쓰게 한다
        // (왼쪽 세로 범례는 그만큼 그래프를 오른쪽으로 밀어 가운데에 몰려 보였다)
        align: 'left',
        verticalAlign: 'top',
        layout: 'horizontal',
        width: 420,
        itemWidth: 420,
        margin: 8,
        itemStyle: { color: text, fontSize: '11px', fontWeight: '400' },
        itemHoverStyle: { color: theme.palette.text.primary },
        symbolHeight: 7,
        symbolRadius: 4,
        useHTML: true,
        // %: 알트코인은 BTC 대비 +면 초록, -면 빨강. BTC(기준)는 오르내림과 관계없이 같은 회색
        labelFormatter(this: any) {
          const { pct, price, isRef } = this.options.custom;
          // 아직 값을 구하지 못했으면(기록 없음) 0% 대신 '-'
          if (pct == null) return `${this.name} <span style="color:${text}">-</span> ${price}`;
          const color = isRef ? text : pct > 0 ? UP : pct < 0 ? DOWN : text;
          const pctText = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
          return `${this.name} <span style="color:${color};font-weight:700">${pctText}</span> ${price}`;
        },
      },
      xAxis: {
        type: 'datetime',
        min: dayStart,
        max: xMax,
        // 눈금은 09:00부터 시작하고, 표시 구간이 12시간을 넘으면 2시간 간격으로 줄여 글자가 겹치거나 기울지 않게 한다
        tickPositioner(this: any) {
          const end = this.max as number;
          const step = end - dayStart > 12 * 3600_000 ? 2 * 3600_000 : 3600_000;
          const ticks: number[] = [];
          for (let t = dayStart; t <= end; t += step) ticks.push(t);
          return ticks;
        },
        labels: {
          // 시:분으로만 표시한다 (날짜는 차트 상단 거래소 이름 옆에 표시)
          formatter(this: any) {
            return Highcharts.dateFormat('%H:%M', this.value);
          },
          style: { color: text, fontSize: '11px' },
          rotation: 0,
          autoRotation: [0],
        },
        lineColor: grid,
        tickColor: grid,
        crosshair: { color: grid },
      },
      yAxis: {
        title: { text: undefined },
        // 오른쪽 여백은 선 끝 라벨이 쓰므로 % 눈금은 왼쪽에 둔다
        opposite: false,
        softMin: -0.5,
        softMax: 0.5,
        labels: { format: '{value:.1f} %', style: { color: text, fontSize: '10px' } },
        gridLineColor: grid,
        // 09:00 시가(0%) 기준선. 코인 선과 헷갈리지 않게 옅은 회색 점선으로 그린다
        // BTC를 선택하지 않았을 때만 0%(BTC 기준) 점선을 그린다. 선택했으면 BTC 선이 기준선이다
        plotLines: coins.includes(REF) ? [] : [{ value: 0, color: theme.palette.mode === 'dark' ? '#5b6070' : '#c4cad3', width: 1, dashStyle: 'Dash', zIndex: 1 }],
      },
      tooltip: {
        shared: true,
        // 예: 10월 12일 21:37 / Oct 12 21:37
        xDateFormat: lang === 'ko' ? '%m월 %d일 %H:%M' : '%b %e %H:%M',
        // 알트코인: BTC 대비 값을 +초록/-빨강으로. BTC: 차트에선 0% 기준선이므로 그 시각 BTC 자신의 등락률을 회색으로
        useHTML: true,
        pointFormatter(this: any) {
          const isRef = this.series.options.id === REF;
          const v: number | undefined = isRef ? refAt.get(this.x) : this.y;
          if (v == null) return '';
          const color = isRef ? text : v > 0 ? UP : v < 0 ? DOWN : text;
          const label = isRef ? ` <span style="color:${text}">(${t('home.cimRef')})</span>` : '';
          return `<span style="color:${this.series.color}">●</span> ${this.series.name}: `
            + `<b style="color:${color}">${v > 0 ? '+' : ''}${v.toFixed(3)} %</b>${label}<br/>`;
        },
        backgroundColor: theme.palette.background.paper,
        borderColor: grid,
        style: { color: theme.palette.text.primary },
      },
      plotOptions: {
        series: {
          // 하루치 1분봉은 최대 1,440개라 기본 한도(1,000개)를 넘으면 선이 그려지지 않는다
          turboThreshold: 0,
          animation: false,
          marker: { enabled: false },
          // 마우스를 올린 선 외의 선이 흐려지지 않도록
          states: { hover: { lineWidthPlus: 0 }, inactive: { opacity: 1 } },
        },
      },
      series: [...series, ...future],
    };
    // version이 기록 변경을 나타낸다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, selKey, currency, theme.palette.mode, exchange.id, dayStart, lang]);

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <ExchangeBadge ex={exchange} size={20} />
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{exchange.label}</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          · {Highcharts.dateFormat(lang === 'ko' ? '%m월 %d일' : '%b %e', dayStart)} 09:00 ~ · {t('home.cimVsBtc')}
        </Typography>
        {loading && <CircularProgress size={14} sx={{ ml: 1 }} />}
      </Box>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </Box>
  );
};

export default Cim;
