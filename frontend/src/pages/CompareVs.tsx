import React, { useMemo, useRef, useState } from 'react';
import { Box, Button, Divider, IconButton, MenuItem, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import Highcharts from 'highcharts/highstock';
import { useTheme } from '@mui/material/styles';
import SidebarLayout from '../components/SidebarLayout';
import SidebarMenu, { MenuGroup } from '../components/SidebarMenu';
import StockChart, { StockChartHandle, baseOptions, yAxis } from '../components/StockChart';
import { useI18n, TKey } from '../i18n';
import { CardRange, CatalogItem, compareItems } from '../lib/catalog';
import { downloadCsv, formatTime, sma, storage } from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { Interval, Point } from '../services/market';

type Scale = 'linear' | 'log' | 'percent';
const MA_OPTIONS = [0, 7, 14, 30, 50, 90];
const RANGES: CardRange[] = ['1D', '1W', '1M', '1Y', 'ALL'];
const AUTO: Record<CardRange, { interval: Interval; limit: number }> = {
  '1D': { interval: '5m', limit: 288 },
  '1W': { interval: '1h', limit: 168 },
  '1M': { interval: '4h', limit: 180 },
  '1Y': { interval: '1d', limit: 365 },
  'ALL': { interval: '1w', limit: 1000 },
};
const COLORS = ['#3d6cf4', '#f7931a', '#26a69a', '#ab47bc', '#ef5350', '#ffca28', '#00acc1', '#8d6e63'];
const MAX = 8;

interface SavedChart {
  name: string;
  checked: string[];
  range: CardRange;
  ma: number;
  scale: Scale;
}

const toggleSx = (active: boolean) => ({
  minWidth: 0, px: 1.5, py: 0.3, fontSize: 11, fontWeight: 700, borderRadius: 0,
  bgcolor: active ? 'ui.chip.activeBg' : 'transparent', color: active ? 'ui.chip.activeFg' : 'ui.card.muted', border: 1, borderColor: 'ui.card.iconBorder',
});

const CompareVs: React.FC = () => {
  const { t } = useI18n();
  const theme = useTheme();
  const cardBg = theme.palette.ui.card.bg;
  const isDark = theme.palette.mode === 'dark';
  const chartRef = useRef<StockChartHandle>(null);
  const items = useMemo(() => compareItems(), []);
  const [checked, setChecked] = useState<string[]>(() => storage.get('compareChecked', ['BTC', 'ETH']));
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<CardRange>('1M');
  const [ma, setMa] = useState(0);
  const [scale, setScale] = useState<Scale>('percent');
  // 내 차트: 선택 항목·기간·이동평균·스케일을 이름 붙여 저장
  const [saved, setSaved] = useState<SavedChart[]>(() => storage.get('compareSavedCharts', []));
  const persistSaved = (next: SavedChart[]) => { setSaved(next); storage.set('compareSavedCharts', next); };
  const saveCurrent = () => persistSaved([...saved, { name: `${t('compare.myChart')} ${saved.length + 1}`, checked, range, ma, scale }]);
  const loadSaved = (c: SavedChart) => {
    setChecked(c.checked); storage.set('compareChecked', c.checked);
    setRange(c.range); setMa(c.ma); setScale(c.scale); setFrom(''); setTo('');
  };
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const toggle = (id: string) => {
    const next = checked.includes(id) ? checked.filter(c => c !== id) : [...checked, id].slice(-MAX);
    setChecked(next);
    storage.set('compareChecked', next);
  };

  // 사이드바 그룹: 파생상품은 코인별로 나눈다
  const groups: MenuGroup[] = useMemo(() => {
    const pick = (fn: (i: CatalogItem) => boolean) => items.filter(fn).map(i => ({ id: i.id, label: i.label }));
    return [
      { key: 'crypto', title: t('group.crypto'), items: pick(i => i.group === 'crypto') },
      { key: 'd-btc', title: `${t('group.derivatives')}(BTC)`, items: pick(i => i.id.startsWith('BTC-OI')) },
      { key: 'd-eth', title: `${t('group.derivatives')}(ETH)`, items: pick(i => i.id.startsWith('ETH-OI')) },
      { key: 'premium', title: t('group.premium'), items: pick(i => i.group === 'premium') },
      { key: 'indices', title: t('group.indices' as TKey), items: pick(i => i.group === 'indices') },
      { key: 'commodity', title: t('group.commodity' as TKey), items: pick(i => i.group === 'commodity') },
    ];
  }, [items, t]);

  const selected = checked.map(id => items.find(i => i.id === id)).filter((i): i is CatalogItem => !!i);
  const { interval, limit } = AUTO[range];
  const result = useAsync(async () => {
    const settled = await Promise.allSettled(selected.map(i => i.load(interval, limit)));
    return selected.map((item, idx) => {
      const r = settled[idx];
      return { item, points: r.status === 'fulfilled' ? r.value : ([] as Point[]) };
    });
  }, [checked.join(','), range], 120_000);

  const options = useMemo<Highcharts.Options>(() => {
    const base = baseOptions();
    const rows = result.data ?? [];
    const percent = scale === 'percent';
    const min = from ? new Date(from).getTime() : undefined;
    const max = to ? new Date(to).getTime() + 86_400_000 : undefined;
    const series: Highcharts.SeriesOptionsType[] = [];
    rows.forEach((r, i) => {
      const pts = r.points.map(p => [p.t, p.v] as [number, number]);
      // 값 자체가 %인 지표(김프)는 첫 값 대비 변화율이 의미가 없으므로 차이(%p)로 비교한다
      const compare = percent ? (r.item.unit === 'percent' ? 'value' : 'percent') : undefined;
      const common = { yAxis: percent ? 0 : i, color: COLORS[i % COLORS.length], compare } as const;
      series.push({ type: 'line', name: r.item.label, data: pts, lineWidth: 1.6, ...common } as Highcharts.SeriesOptionsType);
      if (ma > 0) {
        series.push({ type: 'line', name: `${r.item.short} MA${ma}`, data: sma(pts, ma), dashStyle: 'ShortDash', lineWidth: 1, opacity: 0.7, ...common } as Highcharts.SeriesOptionsType);
      }
    });
    return {
      ...base,
      chart: { ...base.chart, backgroundColor: cardBg, height: 460 },
      xAxis: { ...(base.xAxis as Highcharts.XAxisOptions), min, max },
      yAxis: percent
        ? [yAxis({ labels: { format: '{value}%', align: 'left', x: 6, style: { color: '#8b95a1' } } })]
        : rows.map((r, i) => yAxis({
          // 김프는 음수가 될 수 있어 로그 축 대신 선형 축
          type: scale === 'log' && r.item.unit !== 'percent' ? 'logarithmic' : 'linear', visible: i < 2, opposite: i % 2 === 0, gridLineWidth: i === 0 ? 1 : 0,
          labels: { align: i % 2 === 0 ? 'left' : 'right', x: i % 2 === 0 ? 6 : -6, style: { color: COLORS[i % COLORS.length] } },
        })),
      plotOptions: { ...base.plotOptions, series: { ...base.plotOptions!.series, compareStart: true } as any },
      series,
    };
  }, [result.data, scale, ma, from, to, cardBg]);

  const onCsv = () => {
    const rows = result.data ?? [];
    const times = Array.from(new Set(rows.flatMap(r => r.points.map(p => p.t)))).sort((a, b) => a - b);
    const maps = rows.map(r => new Map(r.points.map(p => [p.t, p.v])));
    downloadCsv(`compare_${range}.csv`, ['time', ...rows.map(r => r.item.label)], times.map(ti => [formatTime(ti), ...maps.map(m => m.get(ti) ?? null)]));
  };

  const dateInputSx = {
    '& input': { color: 'ui.card.fg', fontSize: 11, py: 0.6, colorScheme: isDark ? 'dark' : 'light' },
    '& fieldset': { borderColor: 'ui.card.iconBorder' },
  };

  return (
    <SidebarLayout sidebar={
      <SidebarMenu title={t('compare.title')} groups={groups} query={query} onQueryChange={setQuery}
        checked={checked} onToggle={toggle} searchPlaceholder={t('cards.search')} hideSearch divided
        header={
          <Stack direction="row" alignItems="center" sx={{ pb: 1.5, mb: 1, borderBottom: 1, borderColor: 'ui.sidebar.border' }}>
            <Button size="small" onClick={() => { setChecked([]); storage.set('compareChecked', []); }}
              sx={{ color: 'ui.sidebar.fg', fontSize: 12, minWidth: 0, px: 0.5 }}>⟲ {t('compare.reset')}</Button>
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ bgcolor: 'ui.sidebar.badgeBg', color: 'ui.sidebar.badgeFg', borderRadius: 99, px: 1.2, fontSize: 11, fontWeight: 700 }}>
              {items.length}
            </Box>
          </Stack>
        } />
    }>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: '50%', border: 1, borderColor: 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>☰</Box>
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{t('compare.title')}</Typography>
      </Stack>

      <Box sx={{
        bgcolor: 'ui.card.bg', color: 'ui.card.fg', border: 1, borderColor: 'ui.card.border', overflow: 'hidden',
        borderRadius: `${theme.palette.ui.card.radius}px`, boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,27,55,0.06)',
      }}>
        {/* 좁은 화면에서는 줄을 바꿔 잘리지 않게 한다 */}
        <Stack direction="row" flexWrap="wrap" alignItems="center" justifyContent="flex-end" gap={1} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'ui.card.divider' }}>
          <Select size="small" value={ma} onChange={e => setMa(Number(e.target.value))}
            renderValue={v => `MA ${v}`}
            sx={{ height: 26, fontSize: 11, color: 'ui.card.fg', '& fieldset': { borderColor: 'ui.card.iconBorder' }, '& .MuiSvgIcon-root': { color: 'ui.card.fg' } }}>
            {MA_OPTIONS.map(n => <MenuItem key={n} value={n}>MA {n}</MenuItem>)}
          </Select>
          <Stack direction="row">
            {(['linear', 'log', 'percent'] as Scale[]).map(s => (
              <Button key={s} sx={toggleSx(scale === s)} onClick={() => setScale(s)}>{s === 'percent' ? '%' : s.toUpperCase()}</Button>
            ))}
          </Stack>
          <Select size="small" value="" displayEmpty renderValue={() => t('compare.myCharts')}
            sx={{ height: 26, minWidth: 120, fontSize: 11, color: 'ui.card.fg', '& fieldset': { borderColor: 'ui.card.iconBorder' }, '& .MuiSvgIcon-root': { color: 'ui.card.fg' } }}>
            {saved.length === 0 && <MenuItem disabled sx={{ fontSize: 12 }}>{t('compare.noSaved')}</MenuItem>}
            {saved.map((c, i) => (
              <MenuItem key={i} sx={{ fontSize: 12, gap: 1 }} onClick={() => loadSaved(c)}>
                <Box sx={{ flexGrow: 1 }}>{c.name}</Box>
                <Box component="span" sx={{ color: 'text.disabled', fontSize: 11 }}>{c.range}</Box>
                <IconButton size="small" sx={{ p: 0.2, fontSize: 12 }} aria-label={t('common.delete')}
                  onClick={e => { e.stopPropagation(); persistSaved(saved.filter((_, j) => j !== i)); }}>✕</IconButton>
              </MenuItem>
            ))}
            <Divider />
            <MenuItem sx={{ fontSize: 12, color: 'primary.main', fontWeight: 700 }} onClick={saveCurrent} disabled={!checked.length}>
              ＋ {t('compare.saveAs')}
            </MenuItem>
          </Select>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="flex-end" gap={1.5} sx={{ px: 2, pt: 1.5 }}>
          <Stack direction="row" gap={0.5}>
            {RANGES.map(r => (
              <Box key={r} component="button" onClick={() => { setRange(r); setFrom(''); setTo(''); }}
                sx={{
                  width: 28, height: 28, borderRadius: '50%', border: 0, cursor: 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'inherit',
                  bgcolor: r === range ? 'ui.chip.activeBg' : 'ui.chip.bg', color: r === range ? 'ui.chip.activeFg' : 'ui.chip.fg',
                }}>{r}</Box>
            ))}
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ border: 1, borderColor: 'ui.card.divider', borderRadius: 1.5, px: 1, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, color: 'ui.card.muted', mr: 0.5 }}>{t('compare.dateRange')}</Typography>
            <TextField type="date" size="small" value={from} onChange={e => setFrom(e.target.value)} sx={dateInputSx} />
            <Box component="span" sx={{ color: 'ui.card.muted' }}>~</Box>
            <TextField type="date" size="small" value={to} onChange={e => setTo(e.target.value)} sx={dateInputSx} />
          </Stack>
        </Stack>

        <Box sx={{ px: 1, position: 'relative', minHeight: 460 }}>
          {selected.length === 0 ? (
            <Box sx={{ height: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'ui.card.muted', fontSize: 13 }}>
              {t('compare.pick')}
            </Box>
          ) : (
            <StockChart ref={chartRef} options={options} dark={isDark} />
          )}
          {result.loading && selected.length > 0 && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'ui.chip.bg', color: 'ui.card.muted', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>◆</Box>
            </Box>
          )}
        </Box>

        <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={1.5} sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'ui.card.divider' }}>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'ui.card.divider' }} />
          <Tooltip title={t('common.capture')}>
            <IconButton size="small" onClick={() => chartRef.current?.capture('compare')} sx={{ color: 'ui.card.muted', border: 1, borderColor: 'ui.card.iconBorder' }}>📷</IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'ui.card.divider' }} />
          <Button size="small" onClick={onCsv} disabled={!result.data?.length}
            sx={{ bgcolor: 'ui.chip.bg', color: 'ui.card.fg', fontSize: 11, px: 1.5, '&:hover': { bgcolor: 'ui.chip.hover' }, '&.Mui-disabled': { color: 'ui.card.muted' } }}>⬇ {t('compare.csv')}</Button>
        </Stack>
      </Box>
    </SidebarLayout>
  );
};

export default CompareVs;
