import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import ExchangeBadge from './ExchangeBadge';
import { ExchangeMeta, klineOf } from '../lib/exchanges';
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
 * 09:00부터 지금까지는 1분봉으로 채우고, 이후에는 실시간 시세로 현재 분을 갱신한다. 매일 09:00에 초기화된다.
 */
const Cim: React.FC<Props> = ({ exchange, coins, tickers, currency, resetKey }) => {
  const theme = useTheme();
  const history = useRef<Map<string, Series>>(new Map());
  const [version, setVersion] = useState(0);
  const [dayStart, setDayStart] = useState(() => dayStartOf(Date.now()));
  const [loading, setLoading] = useState(false);
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

  // 아직 기록이 없는 코인은 09:00부터의 1분봉으로 채운다
  const coinKey = coins.join(',');
  useEffect(() => {
    const gen = generation.current;
    const missing = coins.filter(c => !history.current.has(c));
    // 선택 해제된 코인 제거
    Array.from(history.current.keys()).forEach(c => { if (!coins.includes(c)) history.current.delete(c); });
    if (!missing.length) {
      setVersion(v => v + 1);
      return;
    }
    setLoading(true);
    Promise.all(missing.map(async c => {
      const { source, symbol } = klineOf(exchange, c);
      try {
        const candles = await fetchKlinesSince(source, symbol, '1m', dayStart);
        if (gen !== generation.current || !candles.length) return;
        const base = candles[0].o;
        const points: [number, number][] = [[dayStart, (candles[0].o / base - 1) * 100]];
        candles.forEach(k => points.push([k.t + MIN, (k.c / base - 1) * 100]));
        history.current.set(c, { base, points });
      } catch {
        /* 캔들이 없는 거래소/코인은 실시간 시세만으로 그린다 */
      }
    })).finally(() => {
      if (gen === generation.current) {
        setLoading(false);
        setVersion(v => v + 1);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinKey, exchange.id, dayStart, resetKey]);

  // 실시간 시세: 현재 분의 점을 갱신하거나 새 분의 점을 추가
  useEffect(() => {
    if (!tickers || tickers.exchange !== exchange.id || loading) return;
    const now = Date.now();
    if (dayStartOf(now) !== dayStart) return;
    const minuteEnd = Math.floor(now / MIN) * MIN + MIN;
    coins.forEach(c => {
      const tk = tickers.data[c];
      if (!tk) return;
      let s = history.current.get(c);
      if (!s) {
        // 캔들 백필 실패 시 첫 시세를 기준가로 사용
        s = { base: tk.price, points: [] };
        history.current.set(c, s);
      }
      const pct = (tk.price / s.base - 1) * 100;
      const last = s.points[s.points.length - 1];
      if (last && last[0] === minuteEnd) last[1] = pct;
      else if (!last || last[0] < minuteEnd) s.points.push([minuteEnd, pct]);
    });
    setVersion(v => v + 1);
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

    const series: Highcharts.SeriesLineOptions[] = coins.map((c, i) => {
      const pts = history.current.get(c)?.points ?? [];
      const lastPct = pts[pts.length - 1]?.[1] ?? 0;
      const price = tickers?.data[c]?.price;
      const color = COLORS[i % COLORS.length];
      return {
        type: 'line',
        id: c,
        name: exchange.market(c),
        color,
        lineWidth: 1.5,
        // 업데이트 시 이전 점의 옵션이 병합되어 남지 않도록 점마다 라벨/마커 여부를 명시
        data: pts.map(([x, y], idx) => {
          const last = idx === pts.length - 1;
          return { x, y, marker: { enabled: last, radius: 4 }, dataLabels: { enabled: last } };
        }),
        custom: { pct: lastPct, price: price != null ? fmt(toDisplay(price)) : '-' },
        dataLabels: {
          enabled: false,
          allowOverlap: true,
          format: '{series.name}',
          align: 'left',
          verticalAlign: 'middle',
          x: 6,
          backgroundColor: color,
          borderRadius: 3,
          padding: 2,
          style: { color: '#fff', fontSize: '10px', fontWeight: '700', textOutline: 'none' },
        },
      };
    });

    return {
      chart: { backgroundColor: 'transparent', height: 520, animation: false, spacing: [10, 70, 10, 10], style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      exporting: { enabled: false },
      legend: {
        enabled: true,
        align: 'left',
        verticalAlign: 'top',
        layout: 'vertical',
        itemStyle: { color: text, fontSize: '11px', fontWeight: '400' },
        itemHoverStyle: { color: theme.palette.text.primary },
        symbolHeight: 7,
        symbolRadius: 4,
        labelFormatter(this: any) {
          const { pct, price } = this.options.custom;
          return `${this.name} ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% ${price}`;
        },
      },
      xAxis: {
        type: 'datetime',
        min: dayStart,
        max: Math.max(now + 30 * MIN, dayStart + 10 * 3600_000),
        tickInterval: 3600_000,
        labels: { format: '{value:%d %Hh}', style: { color: text, fontSize: '10px' } },
        lineColor: grid,
        tickColor: grid,
        crosshair: { color: grid },
      },
      yAxis: {
        title: { text: undefined },
        opposite: true,
        softMin: -0.5,
        softMax: 0.5,
        labels: { format: '{value:.1f} %', style: { color: '#3d6cf4', fontSize: '10px' } },
        gridLineColor: grid,
        plotLines: [{ value: 0, color: '#3d6cf4', width: 1, zIndex: 1 }],
      },
      tooltip: {
        shared: true,
        xDateFormat: '%Y-%m-%d %H:%M',
        valueDecimals: 3,
        valueSuffix: ' %',
        backgroundColor: theme.palette.background.paper,
        borderColor: grid,
        style: { color: theme.palette.text.primary },
      },
      plotOptions: {
        series: {
          animation: false,
          marker: { enabled: false },
          // 마우스를 올린 선 외의 선이 흐려지지 않도록
          states: { hover: { lineWidthPlus: 0 }, inactive: { opacity: 1 } },
        },
      },
      series,
    };
    // version이 기록 변경을 나타낸다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, coinKey, currency, theme.palette.mode, exchange.id, dayStart]);

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <ExchangeBadge ex={exchange} size={20} />
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{exchange.label}</Typography>
        {loading && <CircularProgress size={14} sx={{ ml: 1 }} />}
      </Box>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </Box>
  );
};

export default Cim;
