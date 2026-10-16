import React, { useMemo, useState } from 'react';
import { Box, IconButton, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { CardRange, CatalogItem, RANGE_MS, cardLimit, intervalsFor } from '../lib/catalog';
import { useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { fillRange } from '../lib/chartUtils';
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
  /** 카드(제목·차트)를 누르면 상세 화면으로 */
  onOpen?: () => void;
  /** 상세 화면: 큰 차트, 축 눈금, 범례, 기간 중 변화. onBack은 목록으로 돌아가기 */
  detail?: boolean;
  onBack?: () => void;
}

/** 값 표시: 큰 값은 천 단위, 작은 값은 소수 자릿수를 늘린다 */
const fmtValue = (v: number, percent: boolean) => {
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : abs >= 1 ? 2 : 6;
  return `${v.toLocaleString('en-US', { maximumFractionDigits: digits })}${percent ? '%' : ''}`;
};

/** 기간 중 변화: 일반 값은 등락률(%), % 지표(김프 등)는 차이(%p) */
const changeOf = (pts: Point[], percent: boolean): string | null => {
  const first = pts.find(p => Number.isFinite(p.v));
  const last = pts[pts.length - 1];
  if (!first || !last) return null;
  if (percent) {
    const d = last.v - first.v;
    return `${d > 0 ? '+' : ''}${d.toFixed(2)}%p`;
  }
  if (!first.v) return null;
  const pct = (last.v / first.v - 1) * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
};

/** 마지막 점은 크게, extremes면 기간 중 최고점·최저점에도 작은 점을 찍는다 */
const markPoints = (pts: Point[], extremes: boolean) => {
  let hi = -1;
  let lo = -1;
  if (extremes && pts.length > 2) {
    pts.forEach((p, i) => {
      if (hi < 0 || p.v > pts[hi].v) hi = i;
      if (lo < 0 || p.v < pts[lo].v) lo = i;
    });
  }
  return pts.map((p, i) => {
    if (i === pts.length - 1) return { x: p.t, y: p.v, marker: { enabled: true, radius: 4 } };
    if (i === hi || i === lo) return { x: p.t, y: p.v, marker: { enabled: true, radius: 2.5 } };
    return [p.t, p.v];
  });
};

const chip = (active: boolean) => ({
  width: 26, height: 26, minWidth: 0, borderRadius: '50%', fontSize: 10, fontWeight: 700, p: 0,
  bgcolor: active ? 'ui.chip.activeBg' : 'ui.chip.bg', color: active ? 'ui.chip.activeFg' : 'ui.chip.fg',
  '&:hover': { bgcolor: active ? 'ui.chip.activeBg' : 'ui.chip.hover' },
});

/** "A vs B" 비교 카드 */
const VsCard: React.FC<Props> = ({ title, base, target, favorite, onToggleFavorite, onEmbed, onOpen, detail, onBack }) => {
  const theme = useTheme();
  const { t } = useI18n();
  const backLabel = t('cards.back');
  const dark = theme.palette.mode === 'dark';
  const chartBg = theme.palette.surface.chartBg;
  const [range, setRange] = useState<CardRange>(target.ranges[0]);
  const intervals = intervalsFor(target, range);
  const [interval, setIntervalState] = useState<Interval>(intervals[0]);
  const iv = intervals.includes(interval) ? interval : intervals[0];

  const { data, loading, error } = useAsync(async () => {
    // 장이 닫힌 자산도 직전 값을 이어 그릴 수 있게 기간보다 넉넉히 받는다
    const limit = Math.min(1000, cardLimit(range, iv) * 4);
    const [b, tg] = await Promise.all([base ? base.load(iv, limit) : Promise.resolve([] as Point[]), target.load(iv, limit)]);
    if (range === 'ALL') return { b, tg };
    const end = Date.now();
    const start = end - RANGE_MS[range];
    return { b: fillRange(b, start, end), tg: fillRange(tg, start, end) };
  }, [base?.id, target.id, range, iv], 120_000);

  const height = detail ? 440 : 160;
  const baseColor = dark ? BASE_COLOR_DARK : BASE_COLOR;
  const axisLabels = (color: string, percent: boolean) => ({
    style: { color, fontSize: '10px' },
    formatter(this: any) { return fmtValue(this.value as number, percent); },
  });
  const options = useMemo<Highcharts.Options>(() => ({
    chart: { height, backgroundColor: chartBg, spacing: detail ? [10, 10, 10, 10] : [8, 4, 4, 4], animation: false, style: { fontFamily: 'inherit' } },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: detail, align: 'left', verticalAlign: 'top', itemStyle: { color: dark ? '#c9ced6' : '#333', fontSize: '12px' } },
    exporting: { enabled: false },
    xAxis: {
      // 느린 지표(난이도 등)도 선택한 기간만 보이도록 고정
      min: range === 'ALL' ? undefined : Date.now() - RANGE_MS[range],
      type: 'datetime', lineWidth: 0, tickLength: 4,
      labels: { style: { color: dark ? '#9aa1ad' : '#555', fontSize: '9px' }, format: range === '1D' ? '{value:%d %Hh}' : range === '1Y' || range === 'ALL' ? '{value:%b.%Y}' : '{value:%b \'%d}' },
    },
    // 상세 화면에서는 두 값의 눈금을 양쪽에 보여 준다 (기준: 왼쪽 회색, 비교 대상: 오른쪽 파랑)
    yAxis: detail ? [
      { visible: !!base, title: { text: undefined }, gridLineColor: dark ? '#2f333b' : '#eef0f4', labels: axisLabels(baseColor, base?.unit === 'percent') },
      { visible: true, title: { text: undefined }, opposite: true, gridLineWidth: base ? 0 : 1, gridLineColor: dark ? '#2f333b' : '#eef0f4', labels: axisLabels(TARGET_COLOR, target.unit === 'percent') },
    ] : [
      { visible: false, gridLineColor: dark ? '#2f333b' : '#eef0f4' },
      { visible: false, opposite: true },
    ],
    tooltip: { shared: true, xDateFormat: '%Y-%m-%d %H:%M', valueDecimals: 2, outside: true, ...(detail ? { crosshairs: true } : {}) },
    plotOptions: { series: { turboThreshold: 0, animation: false, lineWidth: 1.2, marker: { enabled: false }, states: { hover: { lineWidthPlus: 0 } } } },
    series: [
      ...(base ? [{ type: 'line' as const, name: base.short, color: baseColor, yAxis: 0, data: markPoints(data?.b ?? [], false) }] : []),
      { type: 'line' as const, name: target.short, color: TARGET_COLOR, yAxis: base || detail ? 1 : 0, data: markPoints(data?.tg ?? [], true) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, base, target.short, target.unit, range, chartBg, dark, detail]);

  return (
    <Box sx={{
      bgcolor: 'ui.card.bg', borderRadius: `${theme.palette.ui.card.radius}px`, color: 'ui.card.fg', overflow: 'hidden',
      border: 1, borderColor: 'ui.card.border', boxShadow: dark ? 'none' : '0 1px 3px rgba(0,27,55,0.06)',
    }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'ui.card.divider', minHeight: 56 }}>
        {detail && onBack && (
          <Tooltip title={backLabel}>
            <IconButton size="small" onClick={onBack} aria-label={backLabel}
              sx={{ width: 28, height: 28, border: 1, borderColor: 'ui.card.iconBorder', color: 'ui.card.fg', fontSize: 14 }}>←</IconButton>
          </Tooltip>
        )}
        <Typography onClick={onOpen} sx={{ flexGrow: 1, fontSize: detail ? 16 : 12, fontWeight: 700, lineHeight: 1.3, cursor: onOpen ? 'pointer' : undefined, '&:hover': onOpen ? { color: TARGET_COLOR } : undefined }}>{title}</Typography>
        <Tooltip title="My chart">
          <IconButton size="small" onClick={onToggleFavorite}
            sx={{ width: 28, height: 28, border: 1, borderColor: 'ui.card.iconBorder', color: favorite ? '#ef5350' : 'ui.card.muted', fontSize: 13 }}>♥</IconButton>
        </Tooltip>
        <Tooltip title="Embed">
          <IconButton size="small" onClick={onEmbed} sx={{ width: 28, height: 28, border: 1, borderColor: 'ui.card.iconBorder', color: 'ui.card.muted', fontSize: 11 }}>{'</>'}</IconButton>
        </Tooltip>
      </Stack>
      {detail && data && (
        // 상세 화면: 기간 중 마지막 값과 변화
        <Stack direction="row" flexWrap="wrap" columnGap={3} rowGap={1} sx={{ px: 2, pt: 1.5 }}>
          {[...(base ? [{ item: base, pts: data.b, color: baseColor }] : []), { item: target, pts: data.tg, color: TARGET_COLOR }].map(({ item, pts, color }) => {
            const last = pts[pts.length - 1];
            const ch = changeOf(pts, item.unit === 'percent');
            return (
              <Box key={item.id}>
                <Typography sx={{ fontSize: 11, color: 'ui.card.muted' }}>{item.label}</Typography>
                <Stack direction="row" alignItems="baseline" gap={1}>
                  <Typography sx={{ fontSize: 18, fontWeight: 800, color }}>{last ? fmtValue(last.v, item.unit === 'percent') : '-'}</Typography>
                  {ch && <Typography sx={{ fontSize: 12, fontWeight: 700, color: ch.startsWith('-') ? '#ef5350' : '#26a69a' }}>{ch} ({range})</Typography>}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
      <Box onClick={onOpen} sx={{ mx: 2, mt: 1.5, position: 'relative', height, bgcolor: 'surface.chartBg', cursor: onOpen ? 'pointer' : undefined }}>
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
