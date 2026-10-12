import React, { useMemo, useState } from 'react';
import { Box, IconButton, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { CardRange, CatalogItem, RANGE_MS, cardLimit, intervalsFor } from '../lib/catalog';
import { useAsync } from '../lib/useAsync';
import { Interval, Point } from '../services/market';

const BASE_COLOR = '#6b6f76';
const BASE_COLOR_DARK = '#a0a6b0';
const TARGET_COLOR = '#3d6cf4';

interface Props {
  title: string;
  /** 없으면 target 하나만 그리는 단일 카드 (마켓 페이지) */
  base?: CatalogItem;
  target: CatalogItem;
  favorite: boolean;
  onToggleFavorite: () => void;
  onEmbed: () => void;
}

const lastPoint = (pts: Point[]) => pts.map((p, i) => (i === pts.length - 1
  ? { x: p.t, y: p.v, marker: { enabled: true, radius: 4 } }
  : [p.t, p.v]));

const chip = (active: boolean) => ({
  width: 26, height: 26, minWidth: 0, borderRadius: '50%', fontSize: 10, fontWeight: 700, p: 0,
  bgcolor: active ? 'ui.chip.activeBg' : 'ui.chip.bg', color: active ? 'ui.chip.activeFg' : 'ui.chip.fg',
  '&:hover': { bgcolor: active ? 'ui.chip.activeBg' : 'ui.chip.hover' },
});

/** "A vs B" 비교 카드 */
const VsCard: React.FC<Props> = ({ title, base, target, favorite, onToggleFavorite, onEmbed }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const chartBg = theme.palette.surface.chartBg;
  const [range, setRange] = useState<CardRange>(target.ranges[0]);
  const intervals = intervalsFor(target, range);
  const [interval, setIntervalState] = useState<Interval>(intervals[0]);
  const iv = intervals.includes(interval) ? interval : intervals[0];

  const { data, loading, error } = useAsync(async () => {
    const limit = cardLimit(range, iv);
    const [b, tg] = await Promise.all([base ? base.load(iv, limit) : Promise.resolve([] as Point[]), target.load(iv, limit)]);
    return { b, tg };
  }, [base?.id, target.id, range, iv], 120_000);

  const options = useMemo<Highcharts.Options>(() => ({
    chart: { height: 160, backgroundColor: chartBg, spacing: [8, 4, 4, 4], animation: false, style: { fontFamily: 'inherit' } },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    exporting: { enabled: false },
    xAxis: {
      // 느린 지표(난이도 등)도 선택한 기간만 보이도록 고정
      min: range === 'ALL' ? undefined : Date.now() - RANGE_MS[range],
      type: 'datetime', lineWidth: 0, tickLength: 4,
      labels: { style: { color: dark ? '#9aa1ad' : '#555', fontSize: '9px' }, format: range === '1D' ? '{value:%d %Hh}' : range === '1Y' || range === 'ALL' ? '{value:%b.%Y}' : '{value:%b \'%d}' },
    },
    yAxis: [
      { visible: false, gridLineColor: dark ? '#2f333b' : '#eef0f4' },
      { visible: false, opposite: true },
    ],
    tooltip: { shared: true, xDateFormat: '%Y-%m-%d %H:%M', valueDecimals: 2, outside: true },
    plotOptions: { series: { animation: false, lineWidth: 1.2, marker: { enabled: false }, states: { hover: { lineWidthPlus: 0 } } } },
    series: [
      ...(base ? [{ type: 'line' as const, name: base.short, color: dark ? BASE_COLOR_DARK : BASE_COLOR, yAxis: 0, data: lastPoint(data?.b ?? []) }] : []),
      { type: 'line' as const, name: target.short, color: TARGET_COLOR, yAxis: base ? 1 : 0, data: lastPoint(data?.tg ?? []) },
    ],
  }), [data, base, target.short, range, chartBg, dark]);

  return (
    <Box sx={{
      bgcolor: 'ui.card.bg', borderRadius: `${theme.palette.ui.card.radius}px`, color: 'ui.card.fg', overflow: 'hidden',
      border: 1, borderColor: 'ui.card.border', boxShadow: dark ? 'none' : '0 1px 3px rgba(0,27,55,0.06)',
    }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'ui.card.divider', minHeight: 56 }}>
        <Typography sx={{ flexGrow: 1, fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{title}</Typography>
        <Tooltip title="My chart">
          <IconButton size="small" onClick={onToggleFavorite}
            sx={{ width: 28, height: 28, border: 1, borderColor: 'ui.card.iconBorder', color: favorite ? '#ef5350' : 'ui.card.muted', fontSize: 13 }}>♥</IconButton>
        </Tooltip>
        <Tooltip title="Embed">
          <IconButton size="small" onClick={onEmbed} sx={{ width: 28, height: 28, border: 1, borderColor: 'ui.card.iconBorder', color: 'ui.card.muted', fontSize: 11 }}>{'</>'}</IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ mx: 2, mt: 1.5, position: 'relative', height: 160, bgcolor: 'surface.chartBg' }}>
        {error ? (
          <Typography sx={{ color: 'ui.card.muted', fontSize: 11, p: 2 }}>No data</Typography>
        ) : (
          <HighchartsReact highcharts={Highcharts} options={options} />
        )}
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'surface.empty', color: 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>◆</Box>
          </Box>
        )}
      </Box>
      <Stack direction="row" alignItems="center" gap={0.5} sx={{ px: 2, py: 1.5 }}>
        {target.ranges.map(r => (
          <Box key={r} component="button" onClick={() => { setRange(r); setIntervalState(intervalsFor(target, r)[0]); }}
            sx={{ ...chip(r === range), border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>{r}</Box>
        ))}
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontSize: 10, color: 'ui.card.muted', mr: 0.5 }}>interval</Typography>
        <Select size="small" value={iv} onChange={e => setIntervalState(e.target.value as Interval)} variant="outlined"
          sx={{ height: 24, fontSize: 10, color: 'ui.card.fg', '& fieldset': { borderColor: 'ui.card.iconBorder' }, '& .MuiSvgIcon-root': { color: 'ui.card.fg', fontSize: 14 } }}>
          {intervals.map(i => <MenuItem key={i} value={i} sx={{ fontSize: 12 }}>{i === '1d' ? '1D' : i === '1w' ? '1W' : i}</MenuItem>)}
        </Select>
      </Stack>
    </Box>
  );
};

export default VsCard;
