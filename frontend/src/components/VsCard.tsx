import React, { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { CardRange, CatalogItem, RANGE_MS, cardLimit, intervalsFor } from '../lib/catalog';
import { useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { fillRange, storage } from '../lib/chartUtils';
import { INDICATORS, IndicatorId, PANE_PX, indicatorSeries } from '../lib/indicators';
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
  /** 카드 위쪽 작은 글씨 (분류 이름) */
  category?: string;
  /** 기간을 바깥에서 정할 때 (목록의 "전체 기간" 일괄 변경) */
  range?: CardRange;
  onRangeChange?: (r: CardRange) => void;
  /** 임베드 링크를 방금 복사했으면 버튼에 "복사됨" */
  copied?: boolean;
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
const VsCard: React.FC<Props> = ({ title, base, target, favorite, onToggleFavorite, onEmbed, onOpen, detail, onBack, category, range: rangeProp, onRangeChange, copied }) => {
  const theme = useTheme();
  const { t } = useI18n();
  const backLabel = t('cards.back');
  const dark = theme.palette.mode === 'dark';
  const [localRange, setLocalRange] = useState<CardRange>(target.ranges[0]);
  // 바깥에서 정한 기간을 이 지표가 지원하지 않으면(느린 지표는 1D 없음) 지원하는 첫 기간으로
  const wanted = rangeProp ?? localRange;
  const range: CardRange = target.ranges.includes(wanted) ? wanted : target.ranges[0];
  const setRange = (r: CardRange) => (onRangeChange ? onRangeChange(r) : setLocalRange(r));
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

  // 상세 화면 보조지표: 고른 지표와 계산 대상(비교 대상 / 기준)을 브라우저에 기억한다
  const [indicators, setIndicators] = useState<IndicatorId[]>(() => storage.get('detailIndicators', []));
  const [indOn, setIndOn] = useState<'target' | 'base'>(() => storage.get('detailIndicatorOn', 'target'));
  const source = base && indOn === 'base' ? 'base' : 'target';
  const toggleIndicator = (id: IndicatorId) => setIndicators(cur => {
    const next = cur.includes(id) ? cur.filter(i => i !== id) : [...cur, id];
    storage.set('detailIndicators', next);
    return next;
  });
  const pickSource = (v: 'target' | 'base') => { setIndOn(v); storage.set('detailIndicatorOn', v); };
  // 도구모음 접기/펼치기. 차트 폭이 바뀌므로 Highcharts에 크기를 다시 맞추게 한다
  const [toolsOpen, setToolsOpen] = useState<boolean>(() => storage.get('detailToolsOpen', true));
  const toggleTools = () => setToolsOpen(v => { storage.set('detailToolsOpen', !v); return !v; });
  useEffect(() => { if (detail) window.dispatchEvent(new Event('resize')); }, [toolsOpen, detail]);
  const ind = detail ? indicatorSeries(indicators, source, source === 'base' ? 0 : 1, 2) : { series: [], panes: [] };
  const height = detail ? 440 + ind.panes.length * PANE_PX : 150;
  // 지표 칸이 생기면 위쪽 가격 칸을 줄이고 그 아래에 칸을 하나씩 쌓는다 (%: 플롯 영역 기준)
  const mainPct = ind.panes.length ? Math.round((320 / (320 + ind.panes.length * PANE_PX)) * 100) : 100;
  const panePct = ind.panes.length ? (100 - mainPct) / ind.panes.length : 0;
  const baseColor = dark ? BASE_COLOR_DARK : BASE_COLOR;
  const axisLabels = (color: string, percent: boolean) => ({
    style: { color, fontSize: '10px' },
    formatter(this: any) { return fmtValue(this.value as number, percent); },
  });
  const options = useMemo<Highcharts.Options>(() => ({
    chart: { height, backgroundColor: 'transparent', spacing: detail ? [10, 10, 10, 10] : [8, 2, 4, 2], animation: false, style: { fontFamily: 'inherit' } },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: detail, align: 'left', verticalAlign: 'top', itemStyle: { color: dark ? '#c9ced6' : '#333', fontSize: '12px' } },
    exporting: { enabled: false },
    xAxis: {
      // 느린 지표(난이도 등)도 선택한 기간만 보이도록 고정
      min: range === 'ALL' ? undefined : Date.now() - RANGE_MS[range],
      type: 'datetime', lineWidth: 0, tickLength: 4,
      labels: { style: { color: dark ? '#828b98' : '#7f8794', fontSize: detail ? '10px' : '11px' }, format: range === '1D' ? '{value:%d %Hh}' : range === '1Y' || range === 'ALL' ? '{value:%b.%Y}' : '{value:%b \'%d}' },
    },
    // 상세 화면에서는 두 값의 눈금을 양쪽에 보여 준다 (기준: 왼쪽 회색, 비교 대상: 오른쪽 파랑)
    yAxis: detail ? [
      { visible: !!base, height: `${mainPct}%`, title: { text: undefined }, gridLineColor: dark ? '#2f333b' : '#eef0f4', labels: axisLabels(baseColor, base?.unit === 'percent') },
      { visible: true, height: `${mainPct}%`, title: { text: undefined }, opposite: true, gridLineWidth: base ? 0 : 1, gridLineColor: dark ? '#2f333b' : '#eef0f4', labels: axisLabels(TARGET_COLOR, target.unit === 'percent') },
      ...ind.panes.map((d, i) => ({
        top: `${mainPct + i * panePct + 3}%`, height: `${panePct - 3}%`, offset: 0, opposite: true,
        title: { text: d.label, style: { color: d.color, fontSize: '10px' } },
        gridLineColor: dark ? '#2f333b' : '#eef0f4', labels: { style: { color: dark ? '#9aa1ad' : '#555', fontSize: '10px' } },
        // RSI 과매수(70)·과매도(30) 기준선
        ...(d.id === 'rsi' ? { min: 0, max: 100, tickPositions: [0, 30, 70, 100], plotLines: [30, 70].map(v => ({ value: v, color: dark ? '#4a4f59' : '#c4cad3', dashStyle: 'Dash' as const, width: 1 })) } : {}),
      })),
    ] : [
      { visible: false },
      { visible: false, opposite: true },
    ],
    tooltip: { shared: true, xDateFormat: '%Y-%m-%d %H:%M', valueDecimals: 2, outside: true, ...(detail ? { crosshairs: true } : {}) },
    plotOptions: { series: { turboThreshold: 0, animation: false, lineWidth: 1.2, marker: { enabled: false }, states: { hover: { lineWidthPlus: 0 } } } },
    series: [
      ...(base ? [{ type: 'line' as const, id: 'base', name: base.short, color: baseColor, yAxis: 0, data: markPoints(data?.b ?? [], false) }] : []),
      { type: 'line' as const, id: 'target', name: target.short, color: TARGET_COLOR, yAxis: base || detail ? 1 : 0, data: markPoints(data?.tg ?? [], true) },
      ...ind.series,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, base, target.short, target.unit, range, dark, detail, indicators.join(','), source]);

  return (
    <Box sx={{
      bgcolor: 'background.paper', borderRadius: '16px', color: 'text.primary', overflow: 'hidden',
      border: 1, borderColor: 'divider', transition: 'border-color .15s', '&:hover': { borderColor: dark ? '#39404c' : '#cdd3dc' },
    }}>
      <Stack direction="row" alignItems="flex-start" gap={1} sx={{ px: 2.5, pt: 2.25 }}>
        {detail && onBack && (
          <Tooltip title={backLabel}>
            <IconButton size="small" onClick={onBack} aria-label={backLabel}
              sx={{ width: 32, height: 32, border: 1, borderColor: 'divider', borderRadius: 2, color: 'text.primary', fontSize: 14 }}>←</IconButton>
          </Tooltip>
        )}
        <Stack sx={{ flex: 1, minWidth: 0, gap: 0.375 }}>
          {category && <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>{category}</Typography>}
          <Typography onClick={onOpen} sx={{
            fontSize: detail ? 18 : 16, fontWeight: 800, lineHeight: 1.3, cursor: onOpen ? 'pointer' : undefined,
            '&:hover': onOpen ? { color: TARGET_COLOR } : undefined,
          }}>{title}</Typography>
        </Stack>
        <Tooltip title={t('cards.favTip')}>
          <Box component="button" type="button" onClick={onToggleFavorite} aria-pressed={favorite} sx={{
            width: 32, height: 32, border: 1, borderColor: 'divider', borderRadius: 2, cursor: 'pointer', fontSize: 13, flexShrink: 0,
            bgcolor: favorite ? 'rgba(239,83,80,0.10)' : 'background.paper', color: favorite ? '#ef5350' : 'text.secondary',
          }}>♥</Box>
        </Tooltip>
        <Tooltip title={t('cards.embedTip')}>
          <Box component="button" type="button" onClick={onEmbed} sx={{
            height: 32, minWidth: 32, px: 1, border: 1, borderColor: 'divider', borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            fontFamily: 'inherit', bgcolor: 'background.paper', color: copied ? TARGET_COLOR : 'text.secondary', flexShrink: 0,
          }}>{copied ? t('cards.copied') : '</>'}</Box>
        </Tooltip>
      </Stack>
      {!detail && (
        // 기간 중 변화: 기준(BTC)과 비교 지표
        <Stack direction="row" gap={2} sx={{ px: 2.5, pt: 1.5, fontSize: 13, minWidth: 0 }}>
          {[...(base ? [{ item: base, pts: data?.b ?? [], color: baseColor }] : []), { item: target, pts: data?.tg ?? [], color: TARGET_COLOR }].map(({ item, pts, color }) => {
            const ch = changeOf(pts, item.unit === 'percent');
            return (
              <Stack key={item.id} direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{item.short}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, flexShrink: 0, color: ch == null ? 'text.secondary' : ch.startsWith('-') ? '#ef5350' : '#26a69a' }}>{ch ?? '-'}</Typography>
              </Stack>
            );
          })}
        </Stack>
      )}
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
      {detail ? (
        // 상세 화면: 왼쪽 도구모음(보조지표 켜고 끄기·계산 대상) + 차트
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} sx={{ mx: 2, mt: 1.5 }}>
          <Box sx={{
            width: { md: toolsOpen ? 168 : 36 }, flexShrink: 0, border: 1, borderColor: 'ui.card.border', borderRadius: 2, overflow: 'hidden',
            alignSelf: { md: 'flex-start' },
          }}>
            <Stack direction="row" alignItems="center" sx={{ px: 1, py: 0.75, borderBottom: toolsOpen ? 1 : 0, borderColor: 'ui.card.divider' }}>
              {toolsOpen && <Typography sx={{ flexGrow: 1, fontSize: 12, fontWeight: 800 }}>{t('cards.tools')}</Typography>}
              <Tooltip title={toolsOpen ? t('cards.toolsHide') : t('cards.toolsShow')}>
                <IconButton size="small" onClick={toggleTools} aria-expanded={toolsOpen} sx={{ width: 22, height: 22, fontSize: 13, color: 'ui.card.muted' }}>
                  {toolsOpen ? '‹' : '☰'}
                </IconButton>
              </Tooltip>
            </Stack>
            {toolsOpen && (
              <Stack sx={{ py: 0.5 }}>
                <Typography sx={{ px: 1.25, pt: 0.5, pb: 0.25, fontSize: 10, fontWeight: 700, color: 'ui.card.muted' }}>{t('cards.indicators')}</Typography>
                {INDICATORS.map(d => {
                  const on = indicators.includes(d.id);
                  return (
                    <Box key={d.id} component="button" type="button" onClick={() => toggleIndicator(d.id)} aria-pressed={on}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.6, border: 0, bgcolor: on ? 'ui.chip.bg' : 'transparent',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 500, color: 'ui.card.fg', textAlign: 'left',
                        '&:hover': { bgcolor: 'ui.chip.hover' },
                      }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, border: 2, borderColor: d.color, bgcolor: on ? d.color : 'transparent', flexShrink: 0 }} />
                      <Box component="span" sx={{ flexGrow: 1 }}>{d.label}</Box>
                      {on && <Box component="span" sx={{ color: d.color, fontSize: 11 }}>✓</Box>}
                    </Box>
                  );
                })}
                {base && (
                  <>
                    <Typography sx={{ px: 1.25, pt: 1, pb: 0.5, fontSize: 10, fontWeight: 700, color: 'ui.card.muted' }}>{t('cards.indicatorOn')}</Typography>
                    <Stack direction="row" gap={0.5} sx={{ px: 1.25, pb: 0.75 }}>
                      {([['target', target.short], ['base', base.short]] as const).map(([v, label]) => (
                        <Box key={v} component="button" type="button" onClick={() => pickSource(v)}
                          sx={{ ...chip(source === v), width: 'auto', height: 22, borderRadius: 99, px: 1, border: 0, cursor: 'pointer', fontFamily: 'inherit', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </Box>
                      ))}
                    </Stack>
                  </>
                )}
              </Stack>
            )}
          </Box>
        <Box onClick={onOpen} sx={{ flex: 1, minWidth: 0, position: 'relative', height, bgcolor: 'surface.chartBg', cursor: onOpen ? 'pointer' : undefined }}>
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
        </Stack>
      ) : (
      <Box onClick={onOpen} sx={{
        mx: 2.5, mt: 1.5, position: 'relative', height, cursor: onOpen ? 'pointer' : undefined,
        borderTop: 1, borderBottom: 1, borderColor: 'ui.card.divider',
        // 가운데 점선 (디자인 기준선)
        '&::before': { content: '""', position: 'absolute', left: 0, right: 0, top: '50%', borderTop: 1, borderColor: 'ui.card.divider', borderTopStyle: 'dashed', pointerEvents: 'none' },
      }}>
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
      )}
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2.5, pt: 1.5, pb: 2 }}>
        {/* 기간 탭: 회색 바탕에 고른 것만 흰 버튼 */}
        <Stack direction="row" gap={0.25} sx={{ p: '3px', borderRadius: '9px', bgcolor: 'ui.pill.bg' }}>
          {target.ranges.map(r => (
            <Box key={r} component="button" type="button" onClick={() => setRange(r)} aria-pressed={r === range} sx={{
              height: 28, minWidth: 36, border: 0, borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
              bgcolor: r === range ? 'background.paper' : 'transparent', color: r === range ? 'text.primary' : 'text.secondary',
              boxShadow: r === range ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>{r}</Box>
          ))}
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{t('cards.interval')}</Typography>
        <Select size="small" value={iv} onChange={e => setIntervalState(e.target.value as Interval)} variant="outlined"
          sx={{ height: 32, fontSize: 13, fontWeight: 700, borderRadius: 2, color: 'text.primary', '& fieldset': { borderColor: 'divider' }, '& .MuiSelect-select': { py: 0, pl: 1 } }}>
          {intervals.map(i => <MenuItem key={i} value={i} sx={{ fontSize: 13 }}>{i === '1d' ? '1D' : i === '1w' ? '1W' : i}</MenuItem>)}
        </Select>
      </Stack>
    </Box>
  );
};

export default VsCard;
