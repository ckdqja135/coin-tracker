import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Drawer, IconButton, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import Highcharts from 'highcharts/highstock';
import { useTheme } from '@mui/material/styles';
import StockChart, { StockChartHandle, baseOptions, yAxis } from '../components/StockChart';
import { useI18n, TKey } from '../i18n';
import { CardRange, CatalogItem, compareItems } from '../lib/catalog';
import { downloadCsv, formatTime, sma, storage } from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { DOWN, UP } from '../lib/vsRef';
import { Interval, Point } from '../services/market';

type Scale = 'linear' | 'log' | 'percent';
const MA_OPTIONS = [0, 7, 20, 50];
const RANGES: CardRange[] = ['1D', '1W', '1M', '1Y', 'ALL'];
const AUTO: Record<CardRange, { interval: Interval; limit: number }> = {
  '1D': { interval: '5m', limit: 288 },
  '1W': { interval: '1h', limit: 168 },
  '1M': { interval: '4h', limit: 180 },
  '1Y': { interval: '1d', limit: 365 },
  'ALL': { interval: '1w', limit: 1000 },
};
const COLORS = ['#3d6cf4', '#f7931a', '#26a69a', '#ab47bc', '#ef5350', '#00acc1', '#7cb342', '#ec407a'];
const MAX = 8;
const DEFAULT_CHECKED = ['BTC', 'ETH'];
const SIDEBAR_W = 280;
const HEADER_H = 92;

interface SavedChart {
  name: string;
  checked: string[];
  range: CardRange;
  ma: number;
  scale: Scale;
}

const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;

/** 회색 바탕에 고른 것만 흰 버튼인 탭 */
const Segmented = <T extends string>({ items, value, onChange }: { items: { k: T; label: string; tip?: string }[]; value: T; onChange: (v: T) => void }) => (
  <Stack direction="row" gap={0.25} sx={{ p: '3px', borderRadius: '10px', bgcolor: 'ui.pill.bg' }}>
    {items.map(it => (
      <Tooltip key={it.k} title={it.tip ?? ''} disableHoverListener={!it.tip}>
        <Box component="button" type="button" onClick={() => onChange(it.k)} aria-pressed={it.k === value} sx={{
          height: 30, minWidth: 42, px: 1.5, border: 0, borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          bgcolor: it.k === value ? 'background.paper' : 'transparent', color: it.k === value ? 'text.primary' : 'text.secondary',
          boxShadow: it.k === value ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
        }}>{it.label}</Box>
      </Tooltip>
    ))}
  </Stack>
);

const outlineBtn = {
  height: 36, px: 1.75, border: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary', borderRadius: '9px',
  fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', '&:hover': { bgcolor: 'ui.pill.bg' },
  '&:disabled': { color: 'text.disabled', cursor: 'default' },
} as const;

/** 비교 차트: 왼쪽에서 최대 8개 지표를 골라 한 차트에 겹쳐 본다 */
const CompareVs: React.FC = () => {
  const { t } = useI18n();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const chartRef = useRef<StockChartHandle>(null);
  const items = useMemo(() => compareItems(), []);
  const [checked, setCheckedState] = useState<string[]>(() => storage.get('compareChecked', DEFAULT_CHECKED));
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [sideOpen, setSideOpen] = useState<boolean>(() => storage.get('compareSidebarOpen', true));
  const [drawer, setDrawer] = useState(false);
  const [range, setRange] = useState<CardRange>('1M');
  const [ma, setMa] = useState(0);
  const [scale, setScale] = useState<Scale>('percent');
  // 보이는 구간: 날짜 입력이나 아래 내비게이터로 정한다 (없으면 기간 전체)
  const [view, setView] = useState<{ min: number; max: number } | null>(null);
  // 내 차트: 선택 항목·기간·이동평균·스케일을 이름 붙여 저장
  const [saved, setSaved] = useState<SavedChart[]>(() => storage.get('compareSavedCharts', []));
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const setChecked = (next: string[]) => { setCheckedState(next); storage.set('compareChecked', next); };
  const persistSaved = (next: SavedChart[]) => { setSaved(next); storage.set('compareSavedCharts', next); };
  const saveCurrent = () => {
    if (!checked.length) return;
    persistSaved([...saved, { name: `${t('compare.myChart')} ${saved.length + 1} (${checked.length})`, checked, range, ma, scale }]);
    setJustSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 1500);
  };
  const loadSaved = (c: SavedChart) => {
    setChecked(c.checked); setHidden({});
    setRange(c.range); setMa(c.ma); setScale(c.scale); setView(null);
  };
  const reset = () => { setChecked(DEFAULT_CHECKED); setHidden({}); setRange('1M'); setMa(0); setScale('percent'); setView(null); };

  // 8개가 차면 더 고를 수 없다 (먼저 하나를 빼야 한다)
  const toggle = (id: string) => {
    if (checked.includes(id)) { setChecked(checked.filter(c => c !== id)); return; }
    if (checked.length >= MAX) return;
    setChecked([...checked, id]);
  };
  const colorOf = (id: string) => COLORS[Math.max(0, checked.indexOf(id)) % COLORS.length];

  // 사이드바 그룹: 파생상품은 코인별로 나눈다
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const pick = (fn: (i: CatalogItem) => boolean) => items.filter(fn);
    return [
      { key: 'crypto', title: t('group.crypto'), items: pick(i => i.group === 'crypto') },
      { key: 'd-btc', title: `${t('group.derivatives')} (BTC)`, items: pick(i => i.id.startsWith('BTC-OI')) },
      { key: 'd-eth', title: `${t('group.derivatives')} (ETH)`, items: pick(i => i.id.startsWith('ETH-OI')) },
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
  const rows = useMemo(() => result.data ?? [], [result.data]);

  // 데이터 전체 구간과 지금 보이는 구간
  const extent = useMemo(() => {
    const ts = rows.flatMap(r => r.points.map(p => p.t));
    return ts.length ? { min: Math.min(...ts), max: Math.max(...ts) } : null;
  }, [rows]);
  const shownMin = view?.min ?? extent?.min;
  const shownMax = view?.max ?? extent?.max;
  // 보이는 구간 안의 첫 값 대비 마지막 값 (% 지표는 %p 차이)
  const changeOf = (r: { item: CatalogItem; points: Point[] }) => {
    const pts = r.points.filter(p => (shownMin == null || p.t >= shownMin) && (shownMax == null || p.t <= shownMax));
    if (pts.length < 2) return null;
    const a = pts[0].v;
    const b = pts[pts.length - 1].v;
    if (r.item.unit === 'percent') return { v: b - a, text: `${b - a > 0 ? '+' : ''}${(b - a).toFixed(2)}%p` };
    if (!a) return null;
    const v = (b / a - 1) * 100;
    return { v, text: signed(v) };
  };
  const pointsInView = rows.length ? rows[0].points.filter(p => (shownMin == null || p.t >= shownMin) && (shownMax == null || p.t <= shownMax)).length : 0;

  const brand = theme.palette.primary.main;
  const options = useMemo<Highcharts.Options>(() => {
    const base = baseOptions();
    const percent = scale === 'percent';
    const series: Highcharts.SeriesOptionsType[] = [];
    rows.forEach((r, i) => {
      const pts = r.points.map(p => [p.t, p.v] as [number, number]);
      // 값 자체가 %인 지표(김프)는 첫 값 대비 변화율이 의미가 없으므로 차이(%p)로 비교한다
      const compare = percent ? (r.item.unit === 'percent' ? 'value' : 'percent') : undefined;
      const color = COLORS[i % COLORS.length];
      const visible = !hidden[r.item.id];
      const common = { yAxis: percent ? 0 : i, color, compare, visible } as const;
      series.push({ type: 'line', id: r.item.id, name: r.item.label, data: pts, lineWidth: 2, ...common } as Highcharts.SeriesOptionsType);
      if (ma > 0) {
        series.push({ type: 'line', name: `${r.item.short} MA${ma}`, data: sma(pts, ma), dashStyle: 'ShortDash', lineWidth: 1, opacity: 0.7, ...common } as Highcharts.SeriesOptionsType);
      }
    });
    const grid = isDark ? '#20252e' : '#eef0f3';
    const muted = isDark ? '#828b98' : '#7f8794';
    return {
      ...base,
      chart: { ...base.chart, backgroundColor: 'transparent', height: 520, spacing: [12, 4, 8, 4] },
      legend: { enabled: false },
      navigator: {
        ...base.navigator,
        height: 44,
        maskFill: isDark ? 'rgba(91,143,240,0.18)' : 'rgba(47,111,232,0.12)',
        outlineColor: grid,
        handles: { backgroundColor: brand, borderColor: brand },
        series: { color: muted, lineColor: muted, fillOpacity: 0.05 } as any,
        xAxis: { gridLineColor: grid, labels: { style: { color: muted, fontSize: '11px' } } },
      },
      tooltip: {
        ...base.tooltip,
        backgroundColor: isDark ? 'rgba(42,48,59,0.97)' : 'rgba(18,21,26,0.95)', borderWidth: 0, borderRadius: 10,
        style: { color: '#fff', fontSize: '13px' },
        valueDecimals: 2,
      },
      xAxis: {
        ...(base.xAxis as Highcharts.XAxisOptions),
        min: view?.min, max: view?.max, lineColor: grid, tickColor: grid,
        labels: { style: { color: muted, fontSize: '12px' } },
        events: {
          // 내비게이터를 끌거나 확대하면 보이는 구간을 기억한다 (날짜 입력·정보 줄·칩의 변동률이 따라간다)
          afterSetExtremes(e: any) {
            if (e.trigger) setView({ min: Math.round(e.min), max: Math.round(e.max) });
          },
        },
      },
      yAxis: percent
        ? [yAxis({ gridLineColor: grid, labels: { format: '{value}%', align: 'left', x: 8, style: { color: muted, fontSize: '12px' } } })]
        : rows.map((r, i) => yAxis({
          // 김프는 음수가 될 수 있어 로그 축 대신 선형 축
          type: scale === 'log' && r.item.unit !== 'percent' ? 'logarithmic' : 'linear', visible: i < 2, opposite: i % 2 === 0,
          gridLineWidth: i === 0 ? 1 : 0, gridLineColor: grid,
          labels: { align: i % 2 === 0 ? 'left' : 'right', x: i % 2 === 0 ? 8 : -8, style: { color: COLORS[i % COLORS.length], fontSize: '12px' } },
        })),
      plotOptions: { ...base.plotOptions, series: { ...base.plotOptions!.series, compareStart: true } as any },
      series,
    };
  }, [rows, scale, ma, view, hidden, isDark, brand]);

  const onCsv = () => {
    const times = Array.from(new Set(rows.flatMap(r => r.points.map(p => p.t)))).sort((a, b) => a - b)
      .filter(ti => (shownMin == null || ti >= shownMin) && (shownMax == null || ti <= shownMax));
    const maps = rows.map(r => new Map(r.points.map(p => [p.t, p.v])));
    downloadCsv(`compare_${range}.csv`, ['time', ...rows.map(r => r.item.label)], times.map(ti => [formatTime(ti), ...maps.map(m => m.get(ti) ?? null)]));
  };

  const setDate = (which: 'min' | 'max', value: string) => {
    if (!value || !extent) return;
    const t0 = new Date(`${value}T${which === 'min' ? '00:00' : '23:59'}`).getTime();
    const cur = { min: shownMin ?? extent.min, max: shownMax ?? extent.max };
    const next = { ...cur, [which]: Math.min(Math.max(t0, extent.min), extent.max) };
    if (next.max - next.min < 3600_000) return;
    setView(next);
  };
  const toggleSide = () => {
    if (window.matchMedia('(max-width: 899px)').matches) { setDrawer(true); return; }
    setSideOpen(v => { storage.set('compareSidebarOpen', !v); return !v; });
  };

  const dateSx = {
    height: 36, border: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2, px: 1,
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit', colorScheme: isDark ? 'dark' : 'light',
  } as const;

  const sidebar = (
    <Stack gap={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{t('compare.indicators')}</Typography>
        <Box component="button" type="button" onClick={reset} sx={{ ...outlineBtn, height: 30, px: 1.25, fontSize: 12.5, borderRadius: 2, color: 'text.secondary' }}>
          ↺ {t('compare.reset')}
        </Box>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{
        height: 52, pl: 2, pr: 1.25, borderRadius: '14px', transition: 'all .15s',
        bgcolor: searchFocus ? 'background.paper' : 'ui.pill.bg', border: '1.5px solid', borderColor: searchFocus ? 'primary.main' : 'transparent',
        boxShadow: searchFocus ? (th: any) => `0 0 0 4px ${th.palette.ui.highlight.bg}` : 'none',
      }}>
        <Box component="svg" viewBox="0 0 20 20" aria-hidden sx={{ width: 18, height: 18, flexShrink: 0, color: searchFocus ? 'primary.main' : 'text.secondary' }}>
          <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </Box>
        <Box component="input" value={query} placeholder={t('compare.search')} aria-label={t('compare.search')}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); } }}
          sx={{ flex: 1, minWidth: 0, border: 0, outline: 0, bgcolor: 'transparent', color: 'text.primary', fontFamily: 'inherit', fontSize: 16, fontWeight: 500, '&::placeholder': { color: 'text.secondary', opacity: 1 } }} />
        {query && (
          <Box component="button" type="button" onClick={() => setQuery('')} aria-label="clear" sx={{
            width: 22, height: 22, flexShrink: 0, p: 0, border: 0, borderRadius: '50%', bgcolor: 'divider', color: 'text.secondary', fontSize: 10, cursor: 'pointer',
          }}>✕</Box>
        )}
      </Stack>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
        {t('compare.maxPick', { max: String(MAX) })} · <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>{checked.length}</Box> / {items.length}
      </Typography>
      {groups.map(g => {
        const list = g.items.filter(i => !q || i.label.toLowerCase().includes(q) || i.short.toLowerCase().includes(q));
        if (!list.length) return null;
        const open = !closed[g.key] || !!q;
        return (
          <Stack key={g.key} gap={0.25}>
            <Box component="button" type="button" onClick={() => setClosed(c => ({ ...c, [g.key]: !c[g.key] }))} aria-expanded={open} sx={{
              display: 'flex', alignItems: 'center', gap: 1, height: 34, px: 1, border: 0, borderRadius: 2, bgcolor: 'transparent', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, color: 'primary.main', textAlign: 'left', '&:hover': { bgcolor: 'ui.pill.bg' },
            }}>
              <Box component="span" sx={{ flex: 1 }}>{g.title}</Box>
              <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>{g.items.filter(i => checked.includes(i.id)).length}/{g.items.length}</Box>
              <Box component="span" sx={{ fontSize: 9, color: 'text.secondary' }}>{open ? '▲' : '▼'}</Box>
            </Box>
            {open && list.map(i => {
              const on = checked.includes(i.id);
              const full = !on && checked.length >= MAX;
              return (
                <Box key={i.id} component="button" type="button" onClick={() => toggle(i.id)} aria-pressed={on} disabled={full} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 38, py: 0.75, pr: 1, pl: 1.25, border: 0, borderRadius: 2,
                  bgcolor: 'transparent', cursor: full ? 'not-allowed' : 'pointer', opacity: full ? 0.45 : 1, fontFamily: 'inherit', fontSize: 14,
                  fontWeight: on ? 700 : 500, color: on ? 'text.primary' : 'text.secondary', textAlign: 'left', '&:hover': { bgcolor: full ? 'transparent' : 'ui.pill.bg' },
                }}>
                  {/* 고르면 차트 선 색으로 채운 체크 상자 */}
                  <Box component="span" sx={{
                    width: 18, height: 18, flexShrink: 0, boxSizing: 'border-box', borderRadius: '5px', color: '#fff', fontSize: 11, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...(on ? { bgcolor: colorOf(i.id) } : { border: '1.5px solid', borderColor: 'text.secondary' }),
                  }}>{on ? '✓' : ''}</Box>
                  <Box component="span" sx={{ flex: 1, lineHeight: 1.35 }}>{i.label}</Box>
                </Box>
              );
            })}
          </Stack>
        );
      })}
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', minHeight: `calc(100vh - ${HEADER_H}px)` }}>
      {sideOpen && (
        <Box component="aside" sx={{
          display: { xs: 'none', md: 'block' }, width: SIDEBAR_W, flexShrink: 0, position: 'sticky', top: HEADER_H,
          maxHeight: `calc(100vh - ${HEADER_H}px)`, overflowY: 'auto', boxSizing: 'border-box', pt: 3.5, pr: 2.5, pb: 5, pl: 3.5,
          borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', alignSelf: 'stretch',
        }}>
          {sidebar}
        </Box>
      )}
      <Drawer open={drawer} onClose={() => setDrawer(false)} PaperProps={{ sx: { width: 300, p: 3 } }}>{sidebar}</Drawer>

      <Stack component="main" gap={2.5} sx={{ flex: 1, minWidth: 0, px: { xs: 2, md: 5 }, pt: 3.5, pb: 15 }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.75}>
          <Tooltip title={t('cards.sidebar')}>
            <Box component="button" type="button" onClick={toggleSide} aria-label={t('cards.sidebar')} sx={{
              width: 38, height: 38, border: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.secondary', borderRadius: '10px', fontSize: 16, cursor: 'pointer',
            }}>≡</Box>
          </Tooltip>
          <Typography component="h1" sx={{ m: 0, fontSize: { xs: 22, md: 26 }, fontWeight: 800, letterSpacing: '-0.6px' }}>{t('compare.title')}</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary' }}>{t('compare.count', { n: String(checked.length) })}</Typography>
          <Box sx={{ flex: 1 }} />
          <Select size="small" value="" displayEmpty renderValue={() => t('compare.load')}
            sx={{ height: 38, minWidth: 180, borderRadius: '10px', fontSize: 14, fontWeight: 600, bgcolor: 'background.paper', '& fieldset': { borderColor: 'divider' } }}>
            {saved.length === 0 && <MenuItem disabled sx={{ fontSize: 13 }}>{t('compare.noSaved')}</MenuItem>}
            {saved.map((c, i) => (
              <MenuItem key={i} sx={{ fontSize: 13, gap: 1 }} onClick={() => loadSaved(c)}>
                <Box sx={{ flexGrow: 1 }}>{c.name}</Box>
                <Box component="span" sx={{ color: 'text.disabled', fontSize: 11 }}>{c.range}</Box>
                <IconButton size="small" sx={{ p: 0.2, fontSize: 12 }} aria-label={t('common.delete')}
                  onClick={e => { e.stopPropagation(); persistSaved(saved.filter((_, j) => j !== i)); }}>✕</IconButton>
              </MenuItem>
            ))}
          </Select>
          <Box component="button" type="button" onClick={saveCurrent} disabled={!checked.length} sx={{
            height: 38, px: 1.75, border: 0, bgcolor: 'ui.highlight.bg', color: 'ui.highlight.fg', borderRadius: '10px', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', '&:disabled': { opacity: 0.5, cursor: 'default' },
          }}>{justSaved ? t('compare.saved') : t('compare.save')}</Box>
        </Stack>

        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '18px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 고른 지표: 누르면 숨기기/보이기, ✕로 빼기. 옆 숫자는 보이는 구간의 변동률 */}
          <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
            {selected.map(i => {
              const row = rows.find(r => r.item.id === i.id);
              const ch = row ? changeOf(row) : null;
              const off = !!hidden[i.id];
              return (
                <Stack key={i.id} direction="row" alignItems="center" sx={{ height: 36, borderRadius: '10px', border: 1, borderColor: 'divider', bgcolor: off ? 'ui.pill.bg' : 'background.paper', opacity: off ? 0.5 : 1 }}>
                  <Tooltip title={t('compare.toggleHide')}>
                    <Box component="button" type="button" onClick={() => setHidden(h => ({ ...h, [i.id]: !h[i.id] }))} aria-pressed={!off} sx={{
                      display: 'flex', alignItems: 'center', gap: 1, height: '100%', pl: 1.5, pr: 0.75, border: 0, bgcolor: 'transparent',
                      color: 'text.primary', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <Box component="span" sx={{ width: 14, height: 4, borderRadius: 1, bgcolor: colorOf(i.id) }} />
                      {i.label}
                      {ch && <Box component="span" sx={{ fontWeight: 800, color: ch.v >= 0 ? UP : DOWN }}>{ch.text}</Box>}
                    </Box>
                  </Tooltip>
                  <Tooltip title={t('compare.remove')}>
                    <Box component="button" type="button" onClick={() => toggle(i.id)} aria-label={t('compare.remove')} sx={{
                      width: 28, height: '100%', border: 0, bgcolor: 'transparent', color: 'text.secondary', fontSize: 11, cursor: 'pointer', '&:hover': { color: DOWN },
                    }}>✕</Box>
                  </Tooltip>
                </Stack>
              );
            })}
            {!selected.length && <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t('compare.pick')}</Typography>}
          </Stack>

          <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1.5} sx={{ px: 2.5, py: 1.75 }}>
            <Segmented items={RANGES.map(r => ({ k: r, label: r }))} value={range} onChange={r => { setRange(r); setView(null); }} />
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ fontSize: 13, color: 'text.secondary' }}>
              <Box component="input" type="date" aria-label={t('compare.dateRange')} value={shownMin ? fmtDate(shownMin) : ''}
                min={extent ? fmtDate(extent.min) : undefined} max={extent ? fmtDate(extent.max) : undefined}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate('min', e.target.value)} sx={dateSx} />
              <span>~</span>
              <Box component="input" type="date" aria-label={t('compare.dateRange')} value={shownMax ? fmtDate(shownMax) : ''}
                min={extent ? fmtDate(extent.min) : undefined} max={extent ? fmtDate(extent.max) : undefined}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate('max', e.target.value)} sx={dateSx} />
            </Stack>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" alignItems="center" gap={0.75}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{t('compare.ma')}</Typography>
              <Select size="small" value={ma} onChange={e => setMa(Number(e.target.value))}
                sx={{ height: 36, fontSize: 13, fontWeight: 700, borderRadius: 2, '& fieldset': { borderColor: 'divider' } }}>
                {MA_OPTIONS.map(n => <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n ? `MA ${n}` : t('compare.maNone')}</MenuItem>)}
              </Select>
            </Stack>
            <Segmented<Scale> value={scale} onChange={setScale} items={[
              { k: 'percent', label: '%', tip: t('compare.pctTip') },
              { k: 'linear', label: 'LINEAR', tip: t('compare.linearTip') },
              { k: 'log', label: 'LOG', tip: t('compare.logTip') },
            ]} />
          </Stack>

          <Box sx={{ px: 1.5, position: 'relative', minHeight: 520 }}>
            {selected.length === 0 ? (
              <Box sx={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', fontSize: 14 }}>{t('compare.pick')}</Box>
            ) : (
              <StockChart ref={chartRef} options={options} />
            )}
            {result.loading && selected.length > 0 && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'ui.pill.bg', color: 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>◆</Box>
              </Box>
            )}
          </Box>

          <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1.25} sx={{ px: 2.5, py: 2, borderTop: 1, borderColor: 'divider' }}>
            {shownMin != null && shownMax != null && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                {t('compare.info', { iv: interval, n: String(pointsInView), from: fmtDate(shownMin), to: fmtDate(shownMax) })}
              </Typography>
            )}
            {view && (
              <Box component="button" type="button" onClick={() => setView(null)} sx={{
                height: 28, px: 1.25, border: 0, bgcolor: 'ui.pill.bg', color: 'text.secondary', borderRadius: '7px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('compare.resetZoom')}</Box>
            )}
            <Box sx={{ flex: 1 }} />
            <Box component="button" type="button" onClick={() => chartRef.current?.capture('compare')} disabled={!selected.length} sx={outlineBtn}>{t('compare.png')}</Box>
            <Box component="button" type="button" onClick={onCsv} disabled={!rows.length} sx={outlineBtn}>{t('compare.csv')}</Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default CompareVs;
