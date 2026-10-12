import React, { useMemo, useRef, useState } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import Highcharts from 'highcharts/highstock';
import StockChart, { StockChartHandle, baseOptions, yAxis } from '../components/StockChart';
import ChartToolbar, { Scale } from '../components/ChartToolbar';
import { ChartState, PageHeader, Panel } from '../components/Panel';
import { useI18n, TKey } from '../i18n';
import { findAsset } from '../lib/assets';
import {
  DEFAULT_INTERVAL, RangeKey, downloadCsv, fmtCompact, fmtNumber, fmtPercent, fmtPrice, formatTime, limitFor, sma,
} from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { Interval, fetchKlines, fetchSnapshot } from '../services/market';
import { Indicator, indicatorSeriesType, loadIndicator } from './Home';

const Stat: React.FC<{ label: string; value: React.ReactNode; color?: string; sub?: React.ReactNode }> = ({ label, value, color, sub }) => (
  <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography sx={{ fontWeight: 700, fontSize: 18, color, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
  </Paper>
);

const signColor = (v: number | null | undefined) => (v == null ? undefined : v >= 0 ? '#26a69a' : '#ef5350');

const MINI_INDICATORS: Indicator[] = ['oi', 'funding', 'lsr', 'premium-upbit'];

const MiniChart: React.FC<{ coin: string; indicator: Indicator }> = ({ coin, indicator }) => {
  const { t } = useI18n();
  const { data, error, loading } = useAsync(() => loadIndicator(indicator, coin, '1h', '1W', []), [coin, indicator], 120_000);
  const options = useMemo<Highcharts.Options>(() => {
    const base = baseOptions();
    return {
      ...base,
      chart: { ...base.chart, height: 220 },
      navigator: { enabled: false },
      legend: { enabled: false },
      yAxis: [yAxis()],
      series: [{
        type: indicatorSeriesType(indicator), name: t(`metric.${indicator}` as TKey), data: (data ?? []).map(p => [p.t, p.v]),
        color: '#4fc3f7', negativeColor: '#ef5350', fillOpacity: 0.15, threshold: indicator === 'oi' ? null : 0,
      } as Highcharts.SeriesOptionsType],
    };
  }, [data, indicator, t]);
  return (
    <Panel title={<Typography sx={{ fontWeight: 700 }}>{t(`metric.${indicator}` as TKey)}</Typography>}>
      <ChartState loading={loading} error={error} height={220}><StockChart options={options} /></ChartState>
    </Panel>
  );
};

const CoinPage: React.FC<{ coin: 'BTC' | 'ETH' }> = ({ coin }) => {
  const { t } = useI18n();
  const chartRef = useRef<StockChartHandle>(null);
  const [range, setRange] = useState<RangeKey>('1M');
  const [interval, setInterval] = useState<Interval>(DEFAULT_INTERVAL['1M']);
  const [ma, setMa] = useState(30);
  const [scale, setScale] = useState<Scale>('linear');

  const snap = useAsync(() => fetchSnapshot(coin), [coin], 10_000);
  const candles = useAsync(() => fetchKlines('binance', `${coin}USDT`, interval, limitFor(range, interval)), [coin, range, interval], 60_000);

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseOptions();
    const data = candles.data ?? [];
    const closes = data.map(k => [k.t, k.c] as [number, number]);
    return {
      ...base,
      chart: { ...base.chart, height: 520 },
      yAxis: [
        yAxis({ type: scale === 'log' ? 'logarithmic' : 'linear', height: '78%', labels: { align: 'left', x: 6, format: '$' + '{value:,.0f}', style: { color: '#9aa4b2' } } }),
        yAxis({ top: '80%', height: '20%', offset: 0 }),
      ],
      series: [
        { type: 'candlestick', name: coin, data: data.map(k => [k.t, k.o, k.h, k.l, k.c]) },
        ...(ma > 0 ? [{ type: 'line' as const, name: `MA ${ma}`, data: sma(closes, ma), color: '#ffca28', lineWidth: 1.5 }] : []),
        { type: 'column', name: t('metric.volume'), data: data.map(k => [k.t, k.v]), yAxis: 1, color: '#3d4a5c' },
      ],
    };
  }, [candles.data, ma, scale, coin, t]);

  const s = snap.data;
  const name = findAsset(coin)?.name ?? coin;

  return (
    <>
      <PageHeader title={`${name} (${coin})`} />
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}><Stat label={t('coin.price')} value={fmtPrice(s?.price)} sub={<span style={{ color: signColor(s?.change24h) }}>{fmtPercent(s?.change24h)}</span>} /></Grid>
        <Grid item xs={6} md={3}><Stat label={`${t('coin.high')} / ${t('coin.low')}`} value={fmtPrice(s?.high24h)} sub={fmtPrice(s?.low24h)} /></Grid>
        <Grid item xs={6} md={3}><Stat label={t('coin.volume')} value={`$${fmtCompact(s?.volume24h)}`} /></Grid>
        <Grid item xs={6} md={3}><Stat label={t('coin.oi')} value={`$${fmtCompact(s?.openInterest)}`} /></Grid>
        <Grid item xs={6} md={3}>
          <Stat label={t('coin.funding')} value={fmtPercent(s?.fundingRate, 4)} color={signColor(s?.fundingRate)}
            sub={s?.nextFundingTime ? `${t('coin.nextFunding')} ${formatTime(s.nextFundingTime).slice(11)}` : undefined} />
        </Grid>
        <Grid item xs={6} md={3}><Stat label={t('coin.lsr')} value={fmtNumber(s?.longShortRatio, 3)} /></Grid>
        <Grid item xs={6} md={3}>
          <Stat label={`${t('coin.krw')} (Upbit / Bithumb)`} value={fmtPrice(s?.krwPrice.upbit, 'KRW')} sub={fmtPrice(s?.krwPrice.bithumb, 'KRW')} />
        </Grid>
        <Grid item xs={6} md={3}>
          <Stat label={`${t('coin.premium')} (Upbit / Bithumb)`} value={fmtPercent(s?.premium.upbit)} color={signColor(s?.premium.upbit)}
            sub={`${fmtPercent(s?.premium.bithumb)} · ${t('coin.fx')} ${fmtNumber(s?.usdKrw)}`} />
        </Grid>
      </Grid>

      <Panel>
        <ChartToolbar
          range={range} interval={interval}
          onRangeChange={r => { setRange(r); setInterval(DEFAULT_INTERVAL[r]); }}
          onIntervalChange={setInterval}
          ma={ma} onMaChange={setMa}
          scale={scale} onScaleChange={setScale}
          onCsv={() => downloadCsv(`${coin}_${range}_${interval}.csv`, ['time', 'open', 'high', 'low', 'close', 'volume'],
            (candles.data ?? []).map(k => [formatTime(k.t), k.o, k.h, k.l, k.c, k.v]))}
          onCapture={() => chartRef.current?.capture(`${coin}_${range}`)}
        />
        <ChartState loading={candles.loading} error={candles.error} height={520}>
          <StockChart ref={chartRef} options={options} />
        </ChartState>
      </Panel>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 2 }}>
        {MINI_INDICATORS.map(i => <MiniChart key={i} coin={coin} indicator={i} />)}
      </Box>
    </>
  );
};

export default CoinPage;
