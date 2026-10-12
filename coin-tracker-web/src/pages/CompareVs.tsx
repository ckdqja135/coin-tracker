import React, { useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import Highcharts from 'highcharts/highstock';
import StockChart, { StockChartHandle, baseOptions, yAxis } from '../components/StockChart';
import ChartToolbar, { Scale } from '../components/ChartToolbar';
import { ChartState, PageHeader, Panel } from '../components/Panel';
import { useI18n } from '../i18n';
import { ASSETS, Asset, findAsset } from '../lib/assets';
import {
  DEFAULT_INTERVAL, RangeKey, downloadCsv, formatTime, intervalsForRange, limitFor, sma, storage,
} from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { Candle, Interval, fetchKlines } from '../services/market';

const MAX_ASSETS = 6;
const COLORS = ['#f7931a', '#4fc3f7', '#ab47bc', '#66bb6a', '#ef5350', '#ffca28'];

interface SavedChart {
  name: string;
  assets: string[];
  range: RangeKey;
  interval: Interval;
  ma: number;
  scale: Scale;
}

const CompareVs: React.FC = () => {
  const { t } = useI18n();
  const chartRef = useRef<StockChartHandle>(null);
  const [assets, setAssets] = useState<string[]>(['BTC', 'ETH', 'SPX']);
  const [range, setRange] = useState<RangeKey>('1Y');
  const [interval, setInterval] = useState<Interval>(DEFAULT_INTERVAL['1Y']);
  const [ma, setMa] = useState(0);
  const [scale, setScale] = useState<Scale>('percent');
  const [saved, setSaved] = useState<SavedChart[]>(() => storage.get('compareCharts', []));

  const iv = intervalsForRange(range).includes(interval) ? interval : DEFAULT_INTERVAL[range];
  const key = assets.join(',');
  const result = useAsync(async () => {
    const list = assets.map(id => findAsset(id)!).filter(Boolean);
    // 하나가 실패해도 나머지는 보여준다
    const settled = await Promise.allSettled(list.map(a => fetchKlines(a.source, a.symbol, iv, limitFor(range, iv))));
    return list.map((a, i) => {
      const r = settled[i];
      return { asset: a, candles: r.status === 'fulfilled' ? r.value : [] as Candle[] };
    });
  }, [key, range, iv], 60_000);

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseOptions();
    const rows = result.data ?? [];
    const percent = scale === 'percent';
    const axes: Highcharts.YAxisOptions[] = percent
      ? [yAxis({ labels: { align: 'left', x: 6, format: '{value}%', style: { color: '#9aa4b2' } } })]
      : rows.map((r, i) => yAxis({
        type: scale === 'log' ? 'logarithmic' : 'linear',
        opposite: i % 2 === 0,
        visible: i < 2,
        labels: { align: i % 2 === 0 ? 'left' : 'right', x: i % 2 === 0 ? 6 : -6, style: { color: COLORS[i] } },
        gridLineWidth: i === 0 ? 1 : 0,
      }));

    const series: Highcharts.SeriesOptionsType[] = [];
    rows.forEach((r, i) => {
      const points = r.candles.map(k => [k.t, k.c] as [number, number]);
      series.push({
        type: 'line', name: r.asset.name, data: points, color: COLORS[i], yAxis: percent ? 0 : i,
        compare: percent ? 'percent' : undefined, lineWidth: 1.8,
      } as Highcharts.SeriesOptionsType);
      if (ma > 0) {
        series.push({
          type: 'line', name: `${r.asset.short} MA ${ma}`, data: sma(points, ma), color: COLORS[i], dashStyle: 'ShortDash',
          yAxis: percent ? 0 : i, compare: percent ? 'percent' : undefined, lineWidth: 1, opacity: 0.7,
        } as Highcharts.SeriesOptionsType);
      }
    });

    return {
      ...base,
      yAxis: axes,
      plotOptions: { ...base.plotOptions, series: { ...base.plotOptions!.series, compareStart: true } as any },
      tooltip: {
        ...base.tooltip,
        pointFormat: percent
          ? '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y:,.2f}</b> ({point.change:+.2f}%)<br/>'
          : '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y:,.2f}</b><br/>',
      },
      series,
    };
  }, [result.data, scale, ma]);

  const addAsset = (a: Asset | null) => {
    if (!a || assets.includes(a.id) || assets.length >= MAX_ASSETS) return;
    setAssets([...assets, a.id]);
  };

  const saveChart = () => {
    const next = [...saved, { name: `My Chart${saved.length + 1}`, assets, range, interval: iv, ma, scale }];
    setSaved(next);
    storage.set('compareCharts', next);
  };

  const loadChart = (c: SavedChart) => {
    setAssets(c.assets); setRange(c.range); setInterval(c.interval); setMa(c.ma); setScale(c.scale);
  };

  const deleteChart = (idx: number) => {
    const next = saved.filter((_, i) => i !== idx);
    setSaved(next);
    storage.set('compareCharts', next);
  };

  const onCsv = () => {
    const rows = result.data ?? [];
    const times = Array.from(new Set(rows.flatMap(r => r.candles.map(k => k.t)))).sort((a, b) => a - b);
    const maps = rows.map(r => new Map(r.candles.map(k => [k.t, k.c])));
    downloadCsv(`compare_${assets.join('_')}_${range}.csv`, ['time', ...rows.map(r => r.asset.short)],
      times.map(ti => [formatTime(ti), ...maps.map(m => m.get(ti) ?? null)]));
  };

  return (
    <>
      <PageHeader title={t('compare.title')} desc={t('compare.desc')} />
      <Panel>
        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} sx={{ mb: 2 }}>
          {assets.map((id, i) => (
            <Chip key={id} label={findAsset(id)?.name ?? id} onDelete={assets.length > 1 ? () => setAssets(assets.filter(a => a !== id)) : undefined}
              sx={{ borderLeft: `4px solid ${COLORS[i]}`, fontWeight: 600 }} />
          ))}
          <Autocomplete<Asset>
            size="small"
            options={ASSETS.filter(a => !assets.includes(a.id))}
            getOptionLabel={a => `${a.short} · ${a.name}`}
            groupBy={a => a.category}
            value={null}
            onChange={(_, a) => addAsset(a)}
            disabled={assets.length >= MAX_ASSETS}
            sx={{ width: 240 }}
            renderInput={p => <TextField {...p} placeholder={`+ ${t('compare.addAsset')}`} />}
          />
        </Stack>
        {assets.length >= MAX_ASSETS && <Alert severity="info" sx={{ mb: 1, py: 0 }}>{t('compare.max')}</Alert>}

        <ChartToolbar
          range={range} interval={iv}
          onRangeChange={r => { setRange(r); setInterval(DEFAULT_INTERVAL[r]); }}
          onIntervalChange={setInterval}
          ma={ma} onMaChange={setMa}
          scale={scale} scales={['linear', 'log', 'percent']} onScaleChange={setScale}
          onCsv={onCsv}
          onCapture={() => chartRef.current?.capture(`compare_${assets.join('_')}`)}
        />
        <ChartState loading={result.loading} error={result.error}>
          <StockChart ref={chartRef} options={options} />
        </ChartState>
      </Panel>

      <Panel title={t('common.myCharts')} actions={<Button variant="outlined" size="small" onClick={saveChart}>💾 {t('compare.saveAs')}</Button>}>
        {saved.length === 0 ? (
          <Typography color="text.secondary" variant="body2">{t('common.none')}</Typography>
        ) : (
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {saved.map((c, i) => (
              <Chip key={i} variant="outlined" label={`${c.name} · ${c.assets.join(' / ')} · ${c.range}`}
                onClick={() => loadChart(c)} onDelete={() => deleteChart(i)} />
            ))}
          </Stack>
        )}
      </Panel>
    </>
  );
};

export default CompareVs;
