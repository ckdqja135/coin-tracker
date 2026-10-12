import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Chip, IconButton, List, ListItemButton, ListItemText, ListSubheader, Paper, Stack, Tooltip, Typography } from '@mui/material';
import Highcharts from 'highcharts/highstock';
import StockChart, { StockChartHandle, baseOptions, yAxis } from '../components/StockChart';
import ChartToolbar, { Scale } from '../components/ChartToolbar';
import { ChartState, PageHeader, Panel } from '../components/Panel';
import { useI18n, TKey } from '../i18n';
import { ASSETS, Asset, AssetCategory, findAsset } from '../lib/assets';
import {
  DEFAULT_INTERVAL, RangeKey, downloadCsv, fmtPercent, fmtPrice, formatTime, intervalsForRange, limitFor, sma, storage,
} from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { Interval, fetchKlines } from '../services/market';

const CATEGORIES: AssetCategory[] = ['crypto', 'indices', 'commodity', 'fx'];

const Markets: React.FC = () => {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const chartRef = useRef<StockChartHandle>(null);
  const asset: Asset = findAsset(params.get('asset')) ?? ASSETS[0];
  const [range, setRange] = useState<RangeKey>('1Y');
  const [interval, setInterval] = useState<Interval>(DEFAULT_INTERVAL['1Y']);
  const [ma, setMa] = useState(0);
  const [scale, setScale] = useState<Scale>('linear');
  const [favorites, setFavorites] = useState<string[]>(() => storage.get('marketFavorites', ['BTC', 'SPX', 'GOLD']));

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(next);
    storage.set('marketFavorites', next);
  };

  // 지수/원자재는 1분봉 등 일부 단위가 휴장 시간에 비어있을 수 있음
  const iv = intervalsForRange(range).includes(interval) ? interval : DEFAULT_INTERVAL[range];
  const candles = useAsync(() => fetchKlines(asset.source, asset.symbol, iv, limitFor(range, iv)), [asset.id, range, iv], 60_000);

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseOptions();
    const data = candles.data ?? [];
    const prefix = asset.currency === 'KRW' ? '₩' : asset.category === 'crypto' ? '$' : '';
    return {
      ...base,
      chart: { ...base.chart, height: 540 },
      yAxis: [
        yAxis({ type: scale === 'log' ? 'logarithmic' : 'linear', height: '80%', labels: { align: 'left', x: 6, format: `${prefix}{value:,.2f}`, style: { color: '#9aa4b2' } } }),
        yAxis({ top: '82%', height: '18%', offset: 0 }),
      ],
      series: [
        { type: 'candlestick', name: asset.name, data: data.map(k => [k.t, k.o, k.h, k.l, k.c]) },
        ...(ma > 0 ? [{ type: 'line' as const, name: `MA ${ma}`, data: sma(data.map(k => [k.t, k.c] as [number, number]), ma), color: '#ffca28', lineWidth: 1.5 }] : []),
        { type: 'column', name: t('metric.volume'), data: data.map(k => [k.t, k.v]), yAxis: 1, color: '#3d4a5c' },
      ],
    };
  }, [candles.data, asset, ma, scale, t]);

  const data = candles.data ?? [];
  const last = data[data.length - 1];
  const first = data[0];
  const change = last && first ? (last.c / first.o - 1) * 100 : null;

  const AssetItem = (a: Asset) => (
    <ListItemButton key={a.id} dense selected={a.id === asset.id} onClick={() => setParams({ asset: a.id })}>
      <ListItemText primary={a.short} secondary={a.name} primaryTypographyProps={{ fontWeight: 600, fontSize: 13 }} secondaryTypographyProps={{ fontSize: 11 }} />
    </ListItemButton>
  );

  return (
    <>
      <PageHeader title={t('markets.title')} desc={t('markets.desc')} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: 2, alignItems: 'start' }}>
        <Paper variant="outlined" sx={{ maxHeight: { md: 640 }, overflow: 'auto' }}>
          <List dense disablePadding>
            {favorites.length > 0 && (
              <>
                <ListSubheader sx={{ bgcolor: 'background.paper' }}>⭐ {t('common.myCharts')}</ListSubheader>
                {favorites.map(id => findAsset(id)).filter(Boolean).map(a => AssetItem(a!))}
              </>
            )}
            {CATEGORIES.map(c => (
              <React.Fragment key={c}>
                <ListSubheader sx={{ bgcolor: 'background.paper' }}>{t(`markets.${c}` as TKey)}</ListSubheader>
                {ASSETS.filter(a => a.category === c).map(AssetItem)}
              </React.Fragment>
            ))}
          </List>
        </Paper>

        <Panel
          title={<Stack direction="row" alignItems="center" gap={1}>
            {asset.name}
            <Chip size="small" label={t(`markets.${asset.category}` as TKey)} />
            <Tooltip title={favorites.includes(asset.id) ? t('markets.unfavorite') : t('markets.favorite')}>
              <IconButton size="small" onClick={() => toggleFavorite(asset.id)}>{favorites.includes(asset.id) ? '⭐' : '☆'}</IconButton>
            </Tooltip>
          </Stack>}
          subtitle={last && (
            <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {asset.category === 'crypto' || asset.currency === 'KRW' ? fmtPrice(last.c, asset.currency) : last.c.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              {' '}<span style={{ color: (change ?? 0) >= 0 ? '#26a69a' : '#ef5350' }}>{fmtPercent(change)} ({range})</span>
            </Typography>
          )}
        >
          <ChartToolbar
            range={range} interval={iv}
            onRangeChange={r => { setRange(r); setInterval(DEFAULT_INTERVAL[r]); }}
            onIntervalChange={setInterval}
            ma={ma} onMaChange={setMa}
            scale={scale} onScaleChange={setScale}
            onCsv={() => downloadCsv(`${asset.id}_${range}_${iv}.csv`, ['time', 'open', 'high', 'low', 'close', 'volume'],
              data.map(k => [formatTime(k.t), k.o, k.h, k.l, k.c, k.v]))}
            onCapture={() => chartRef.current?.capture(`${asset.id}_${range}`)}
          />
          <ChartState loading={candles.loading} error={candles.error} height={540}>
            <StockChart ref={chartRef} options={options} />
          </ChartState>
        </Panel>
      </Box>
    </>
  );
};

export default Markets;
