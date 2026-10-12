import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, MenuItem, Snackbar, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import Highcharts from 'highcharts/highstock';
import StockChart, { StockChartHandle, baseOptions, yAxis } from '../components/StockChart';
import ChartToolbar from '../components/ChartToolbar';
import { ChartState, PageHeader, Panel } from '../components/Panel';
import { useI18n, TKey } from '../i18n';
import { CRYPTO_COINS, findAsset } from '../lib/assets';
import {
  DEFAULT_INTERVAL, RangeKey, RANGES, downloadCsv, formatTime, intervalsForRange, limitFor, INTERVAL_MS,
} from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import {
  Candle, Interval, Point, fetchKlines, fetchMetric, fetchPremium, fetchSnapshot,
} from '../services/market';

type Exchange = 'binance' | 'upbit' | 'bithumb';
type Currency = 'USD' | 'KRW';
export type Indicator = 'oi' | 'lsr' | 'top-lsr' | 'taker' | 'funding' | 'premium-upbit' | 'premium-bithumb' | 'volume';

const INDICATORS: Indicator[] = ['oi', 'lsr', 'top-lsr', 'taker', 'funding', 'premium-upbit', 'premium-bithumb', 'volume'];
const EXCHANGES: { id: Exchange; label: string; currency: Currency }[] = [
  { id: 'binance', label: 'Binance', currency: 'USD' },
  { id: 'upbit', label: 'Upbit', currency: 'KRW' },
  { id: 'bithumb', label: 'Bithumb', currency: 'KRW' },
];
const FUNDING_MS = 8 * 3600_000;

/** 지표 시계열 로드. 가격 캔들(volume용)을 재사용한다. */
export const loadIndicator = async (
  indicator: Indicator, coin: string, interval: Interval, range: RangeKey, candles: Candle[],
): Promise<Point[]> => {
  const limit = limitFor(range, interval);
  switch (indicator) {
    case 'volume':
      return candles.map(k => ({ t: k.t, v: k.v }));
    case 'funding': {
      const n = range === 'ALL' ? 1000 : Math.ceil((limit * INTERVAL_MS[interval]) / FUNDING_MS);
      return fetchMetric('funding', `${coin}USDT`, interval, n);
    }
    case 'premium-upbit':
      return fetchPremium(coin, 'upbit', interval, limit);
    case 'premium-bithumb':
      return fetchPremium(coin, 'bithumb', interval, limit);
    default:
      return fetchMetric(indicator, `${coin}USDT`, interval, limit);
  }
};

export const indicatorSeriesType = (i: Indicator): 'line' | 'column' | 'area' =>
  i === 'volume' || i === 'funding' ? 'column' : i === 'oi' ? 'area' : 'line';

const Home: React.FC = () => {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const chartRef = useRef<StockChartHandle>(null);
  const [copied, setCopied] = useState(false);

  // URL 쿼리스트링에 상태를 저장해 링크 공유가 가능하도록 한다
  const coin = findAsset(params.get('coin'))?.category === 'crypto' ? params.get('coin')!.toUpperCase() : 'BTC';
  const exchange = (EXCHANGES.find(e => e.id === params.get('ex'))?.id ?? 'binance') as Exchange;
  const indicator = (INDICATORS.includes(params.get('ind') as Indicator) ? params.get('ind') : 'oi') as Indicator;
  const range = (RANGES.includes(params.get('range') as RangeKey) ? params.get('range') : '1W') as RangeKey;
  const intervalParam = params.get('iv') as Interval;
  const interval = intervalsForRange(range).includes(intervalParam) ? intervalParam : DEFAULT_INTERVAL[range];
  const currency = (params.get('cur') === 'KRW' || params.get('cur') === 'USD'
    ? params.get('cur') : EXCHANGES.find(e => e.id === exchange)!.currency) as Currency;

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => next.set(k, v));
    setParams(next, { replace: true });
  };

  const snapshot = useAsync(() => fetchSnapshot(coin), [coin], 60_000);

  const series = useAsync(async () => {
    const limit = limitFor(range, interval);
    const candles = exchange === 'binance'
      ? await fetchKlines('binance', `${coin}USDT`, interval, limit)
      : await fetchKlines(exchange, coin, interval, limit);
    const ind = await loadIndicator(indicator, coin, interval, range, candles);
    return { candles, ind };
  }, [coin, exchange, indicator, range, interval], 60_000);

  const nativeCurrency = EXCHANGES.find(e => e.id === exchange)!.currency;
  const fx = snapshot.data?.usdKrw ?? null;
  const factor = nativeCurrency === currency || !fx ? 1 : currency === 'KRW' ? fx : 1 / fx;

  const priceName = `${findAsset(coin)?.name ?? coin} (${coin}) · ${EXCHANGES.find(e => e.id === exchange)!.label}`;
  const indName = t(`metric.${indicator}` as TKey);

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseOptions();
    const candles = series.data?.candles ?? [];
    const ind = series.data?.ind ?? [];
    const prefix = currency === 'KRW' ? '₩' : '$';
    return {
      ...base,
      yAxis: [
        yAxis({ labels: { style: { color: '#f7931a' }, align: 'left', x: 6, format: `${prefix}{value:,.0f}` }, height: '100%' }),
        yAxis({ opposite: false, labels: { style: { color: '#4fc3f7' }, align: 'right', x: -6 } }),
      ],
      tooltip: {
        ...base.tooltip,
        pointFormatter(this: any) {
          const v = this.y as number;
          const isPrice = this.series.index === 0;
          const txt = isPrice
            ? `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: currency === 'KRW' ? 0 : 2 })}`
            : Highcharts.numberFormat(v, Math.abs(v) >= 1000 ? 0 : 4);
          return `<span style="color:${this.color}">●</span> ${this.series.name}: <b>${txt}</b><br/>`;
        },
      },
      series: [
        { type: 'line', name: priceName, data: candles.map(k => [k.t, k.c * factor]), yAxis: 0, color: '#f7931a', lineWidth: 2, zIndex: 2 },
        {
          type: indicatorSeriesType(indicator), name: indName, data: ind.map(p => [p.t, p.v]), yAxis: 1, color: '#4fc3f7',
          fillOpacity: 0.15, negativeColor: indicator.startsWith('premium') || indicator === 'funding' ? '#ef5350' : undefined,
          threshold: indicator === 'oi' ? null : 0,
        } as Highcharts.SeriesOptionsType,
      ],
    };
  }, [series.data, factor, currency, priceName, indName, indicator]);

  const onCsv = () => {
    const candles = series.data?.candles ?? [];
    const indMap = new Map((series.data?.ind ?? []).map(p => [p.t, p.v]));
    downloadCsv(`${coin}_${exchange}_${indicator}_${range}.csv`, ['time', `price_${currency}`, indicator],
      candles.map(k => [formatTime(k.t), k.c * factor, indMap.get(k.t) ?? null]));
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch { /* clipboard 권한 없음 */ }
  };

  const limitedMetric = ['oi', 'lsr', 'top-lsr', 'taker'].includes(indicator) && (range === '1Y' || range === 'ALL');

  return (
    <>
      <PageHeader title={t('home.title')} desc={t('home.desc')} />
      <Panel>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} sx={{ mb: 2 }}>
          <TextField select size="small" label={t('home.asset')} value={coin} onChange={e => update({ coin: e.target.value })} sx={{ minWidth: 160 }}>
            {CRYPTO_COINS.map(c => <MenuItem key={c} value={c}>{findAsset(c)?.name} ({c})</MenuItem>)}
          </TextField>
          <TextField select size="small" label={t('common.exchange')} value={exchange}
            onChange={e => update({ ex: e.target.value, cur: EXCHANGES.find(x => x.id === e.target.value)!.currency })} sx={{ minWidth: 130 }}>
            {EXCHANGES.map(e => <MenuItem key={e.id} value={e.id}>{e.label}</MenuItem>)}
          </TextField>
          <ToggleButtonGroup size="small" exclusive value={currency} onChange={(_, v) => v && update({ cur: v })}>
            <ToggleButton value="USD">USD</ToggleButton>
            <ToggleButton value="KRW">KRW</ToggleButton>
          </ToggleButtonGroup>
          <TextField select size="small" label={t('home.indicator')} value={indicator} onChange={e => update({ ind: e.target.value })}
            sx={{ minWidth: 260, ml: { md: 'auto' } }}>
            {INDICATORS.map(i => <MenuItem key={i} value={i}>{t(`metric.${i}` as TKey)}</MenuItem>)}
          </TextField>
        </Stack>

        <ChartToolbar
          range={range} interval={interval}
          onRangeChange={r => update({ range: r, iv: DEFAULT_INTERVAL[r] })}
          onIntervalChange={i => update({ iv: i })}
          onCsv={onCsv}
          onCapture={() => chartRef.current?.capture(`${coin}_${indicator}`)}
          onCopyLink={onCopyLink}
        />
        {limitedMetric && <Alert severity="info" sx={{ mb: 1, py: 0 }}>{t('common.metricLimited')}</Alert>}
        <ChartState loading={series.loading} error={series.error}>
          <StockChart ref={chartRef} options={options} />
        </ChartState>
      </Panel>
      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} message={t('common.copied')} />
    </>
  );
};

export default Home;
