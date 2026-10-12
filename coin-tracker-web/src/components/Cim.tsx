import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import ExchangeBadge from './ExchangeBadge';
import { ExchangeMeta } from '../lib/exchanges';
import { ExchangeTickers } from '../services/market';

const COLORS = ['#3d6cf4', '#f7931a', '#26a69a', '#ab47bc', '#ef5350', '#00acc1', '#8d6e63', '#ec407a', '#7cb342', '#5c6bc0'];
const DAY = 86_400_000;

interface Props {
  exchange: ExchangeMeta;
  coins: string[];
  tickers: ExchangeTickers | undefined;
  currency: 'USD' | 'KRW';
  /** 값이 바뀌면 기준가를 현재가로 다시 잡는다 (Reload) */
  resetKey: number;
}

type Series = { base: number; points: [number, number][] };

/**
 * Coin Impulse Monitor
 * 모니터링 시작 시점(또는 Reload) 가격을 기준(0%)으로 선택한 코인들의 실시간 등락률을 한 차트에 겹쳐
 * 어느 코인에 먼저 순간적인 매수/매도 충격이 들어오는지 비교한다.
 */
const Cim: React.FC<Props> = ({ exchange, coins, tickers, currency, resetKey }) => {
  const theme = useTheme();
  const history = useRef<Map<string, Series>>(new Map());
  const lastTime = useRef(0);
  const [version, setVersion] = useState(0);

  // 거래소 변경 / Reload 시 기록 초기화
  useEffect(() => {
    history.current = new Map();
    lastTime.current = 0;
    setVersion(v => v + 1);
  }, [exchange.id, resetKey]);

  // 새 시세가 들어올 때마다 기록 추가
  useEffect(() => {
    if (!tickers || tickers.exchange !== exchange.id || tickers.time === lastTime.current) return;
    lastTime.current = tickers.time;
    const now = Date.now();
    coins.forEach(c => {
      const tk = tickers.data[c];
      if (!tk) return;
      let s = history.current.get(c);
      if (!s) {
        s = { base: tk.price, points: [] };
        history.current.set(c, s);
      }
      s.points.push([now, (tk.price / s.base - 1) * 100]);
      if (s.points.length > 20_000) s.points.shift();
    });
    // 선택 해제된 코인 제거
    Array.from(history.current.keys()).forEach(c => { if (!coins.includes(c)) history.current.delete(c); });
    setVersion(v => v + 1);
  }, [tickers, coins, exchange.id]);

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
    // 업비트 일봉 기준(UTC 00:00 = KST 09:00)부터 표시
    const dayStart = Math.floor(now / DAY) * DAY;
    const text = theme.palette.text.secondary;
    const grid = theme.palette.mode === 'dark' ? '#2a2f38' : '#eef0f4';

    const series: Highcharts.SeriesLineOptions[] = coins.map((c, i) => {
      const s = history.current.get(c);
      const pts = s?.points ?? [];
      const last = pts[pts.length - 1];
      const price = tickers?.data[c]?.price;
      return {
        type: 'line',
        id: c,
        name: exchange.market(c),
        color: COLORS[i % COLORS.length],
        lineWidth: 1.5,
        data: pts.map((p, idx) => (idx === pts.length - 1
          ? { x: p[0], y: p[1], marker: { enabled: true, radius: 4 }, dataLabels: { enabled: true } }
          : { x: p[0], y: p[1] })),
        custom: { pct: last?.[1] ?? 0, price: price != null ? fmt(toDisplay(price)) : '-' },
        dataLabels: {
          enabled: false,
          format: '{series.name}',
          align: 'left',
          verticalAlign: 'middle',
          x: 6,
          backgroundColor: COLORS[i % COLORS.length],
          borderRadius: 3,
          padding: 2,
          style: { color: '#fff', fontSize: '10px', fontWeight: '700', textOutline: 'none' },
        },
      };
    });

    return {
      chart: { backgroundColor: 'transparent', height: 520, animation: false, spacing: [10, 10, 10, 10], style: { fontFamily: 'inherit' } },
      title: { text: undefined },
      credits: { enabled: false },
      exporting: { enabled: false },
      legend: {
        enabled: true,
        align: 'left',
        verticalAlign: 'top',
        layout: 'vertical',
        floating: false,
        itemStyle: { color: text, fontSize: '11px', fontWeight: '400' },
        itemHoverStyle: { color: theme.palette.text.primary },
        symbolHeight: 7,
        symbolRadius: 4,
        labelFormatter(this: any) {
          const { pct, price } = this.options.custom;
          return `${this.name} ${pct >= 0 ? '' : ''}${pct.toFixed(2)}% ${price}`;
        },
      },
      xAxis: {
        type: 'datetime',
        min: dayStart,
        max: Math.max(now + 30 * 60_000, dayStart + 10 * 3600_000),
        tickInterval: 3600_000,
        labels: { format: '{value:%d %Hh}', style: { color: text, fontSize: '10px' } },
        lineColor: grid,
        tickColor: grid,
        gridLineWidth: 0,
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
        xDateFormat: '%Y-%m-%d %H:%M:%S',
        valueDecimals: 3,
        valueSuffix: ' %',
      },
      plotOptions: { series: { animation: false, marker: { enabled: false }, states: { hover: { lineWidthPlus: 0 } } } },
      series,
    };
    // version이 기록 변경을 나타낸다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, coins, currency, theme.palette.mode, exchange.id]);

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <ExchangeBadge ex={exchange} size={20} />
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{exchange.label}</Typography>
      </Box>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </Box>
  );
};

export default Cim;
