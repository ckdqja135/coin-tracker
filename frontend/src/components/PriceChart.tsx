import React, { useMemo, useState } from 'react';
import { Box, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import CoinIcon from './CoinIcon';
import { useI18n } from '../i18n';
import { findAsset } from '../lib/assets';
import { exchangeMeta, klineOf } from '../lib/exchanges';
import '../lib/indicators';
import { useAsync } from '../lib/useAsync';
import { Candle, Interval, fetchKlines, fetchSeries } from '../services/market';

/** 가격 차트에 띄울 수 있는 지수·시장 (코인 외) */
export const MACRO_SYMBOLS = ['SPX', 'NDX', 'DXY', 'BTC.D'] as const;
export type MacroSymbol = typeof MACRO_SYMBOLS[number];
const MACRO_NAME: Record<MacroSymbol, string> = { SPX: 'S&P 500', NDX: 'US 100', DXY: 'Dollar Index', 'BTC.D': 'BTC Dominance (%)' };

const IVS: { k: Interval; key: string; limit: number }[] = [
  { k: '1m', key: 'pc.iv.1m', limit: 240 },
  { k: '30m', key: 'pc.iv.30m', limit: 240 },
  { k: '1h', key: 'pc.iv.1h', limit: 240 },
  { k: '1d', key: 'pc.iv.1d', limit: 365 },
];
type ChartType = 'candle' | 'line' | 'area';
const UP = '#0c8f60';
const DOWN = '#d63c42';
const MA = [{ k: 20, color: '#e08a12' }, { k: 60, color: '#9b51e0' }];

const isMacro = (s: string): s is MacroSymbol => (MACRO_SYMBOLS as readonly string[]).includes(s);
const fmtNum = (v: number) => (v >= 1000 ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v >= 1 ? v.toFixed(3) : v.toPrecision(5));
const fmtVol = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(2)}K` : v.toFixed(1));

/** 가격 차트에서 고를 코인 목록과 각 코인의 데이터 출처 (바이낸스 USDT 우선, 없으면 업비트 원화) */
export interface ChartCoin { symbol: string; onBinance: boolean }

const segBtn = (active: boolean) => ({
  height: 30, minWidth: 44, px: 1.25, border: 0, borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
  bgcolor: active ? 'background.paper' : 'transparent', color: active ? 'text.primary' : 'text.secondary',
  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
});
const Seg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Stack direction="row" gap={0.25} sx={{ p: '3px', borderRadius: '9px', bgcolor: 'ui.pill.bg' }}>{children}</Stack>
);
const Sep = () => <Box sx={{ width: '1px', height: 20, bgcolor: 'divider' }} />;

/**
 * 가격 차트: 선택 코인(바이낸스 USDT, 없으면 업비트) 또는 지수의 캔들·라인·영역 차트 + 거래량 + 이동평균.
 * 마우스를 올린 봉의 시·고·저·종과 거래량을 위에 보여준다.
 */
const PriceChart: React.FC<{
  symbol: string; coins: ChartCoin[]; onSymbol: (s: string) => void; open: boolean; onToggle: () => void;
}> = ({ symbol, coins, onSymbol, open, onToggle }) => {
  const { t } = useI18n();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const [iv, setIv] = useState<Interval>('1d');
  const [type, setType] = useState<ChartType>('candle');
  const [mas, setMas] = useState<Record<number, boolean>>({ 20: true, 60: false });
  const [hover, setHover] = useState<number | null>(null);
  const macro = isMacro(symbol);
  // 지수 중 BTC 도미넌스는 서버가 기록한 값(종가만)이라 라인/영역으로 그린다
  const closeOnly = symbol === 'BTC.D';
  const coin = coins.find(c => c.symbol === symbol);
  const source = macro ? null : coin?.onBinance === false ? klineOf(exchangeMeta('upbit'), symbol) : { source: 'binance' as const, symbol: `${symbol}USDT` };
  const limit = IVS.find(x => x.k === iv)!.limit;

  const { data, loading, error } = useAsync<Candle[]>(async () => {
    if (!open) return [];
    if (symbol === 'BTC.D') {
      const pts = await fetchSeries('btc-dominance', 'BTC', iv === '1m' ? '30m' : iv, limit);
      return pts.map(p => ({ t: p.t, o: p.v, h: p.v, l: p.v, c: p.v, v: 0 }));
    }
    if (macro) {
      const a = findAsset(symbol)!;
      return fetchKlines(a.source, a.symbol, iv, limit);
    }
    return fetchKlines(source!.source, source!.symbol, iv, limit);
  }, [symbol, iv, open, source?.source], iv === '1m' ? 30_000 : 120_000);

  const candles = useMemo(() => data ?? [], [data]);
  const effType: ChartType = closeOnly && type === 'candle' ? 'line' : type;
  const upColor = dark ? '#2fc28a' : UP;
  const downColor = dark ? '#f2696e' : DOWN;
  const grid = dark ? '#20252e' : '#eef0f3';
  const muted = dark ? '#828b98' : '#7f8794';
  const brand = theme.palette.primary.main;

  const options = useMemo<Highcharts.Options>(() => {
    const last = candles[candles.length - 1];
    const lastUp = last ? last.c >= last.o : true;
    const priceSeries: Highcharts.SeriesOptionsType = effType === 'candle'
      ? { type: 'candlestick', id: 'price', name: symbol, data: candles.map(k => [k.t, k.o, k.h, k.l, k.c]), color: downColor, upColor, lineColor: downColor, upLineColor: upColor } as any
      : { type: effType === 'area' ? 'area' : 'line', id: 'price', name: symbol, data: candles.map(k => [k.t, k.c]), color: brand, lineWidth: 2,
        fillColor: effType === 'area' ? { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, `${brand}33`], [1, `${brand}05`]] } : undefined } as any;
    const hasVol = candles.some(k => k.v > 0);
    return {
      chart: { height: 400, backgroundColor: 'transparent', spacing: [8, 4, 4, 4], animation: false, style: { fontFamily: 'inherit' } },
      credits: { enabled: false }, exporting: { enabled: false }, rangeSelector: { enabled: false }, navigator: { enabled: false }, scrollbar: { enabled: false },
      legend: { enabled: false },
      // 값은 위쪽 OHLC 줄에 보여주므로 툴팁은 끈다
      tooltip: { enabled: false },
      xAxis: {
        lineColor: grid, tickColor: grid, labels: { style: { color: muted, fontSize: '12px' } },
        crosshair: { color: muted, dashStyle: 'Dash' },
      },
      yAxis: [
        {
          height: hasVol ? '78%' : '100%', opposite: true, gridLineColor: grid, title: { text: undefined },
          labels: { align: 'left', x: 8, style: { color: muted, fontSize: '12px' }, formatter(this: any) { return fmtNum(this.value); } },
          // 마지막 가격선과 값 표시
          plotLines: last ? [{
            value: last.c, color: lastUp ? upColor : downColor, dashStyle: 'Dash', width: 1, zIndex: 3,
            label: { text: fmtNum(last.c), align: 'right', x: -2, y: -6, useHTML: true, style: { color: '#fff', fontSize: '12px', fontWeight: '800', backgroundColor: lastUp ? upColor : downColor, padding: '2px 6px', borderRadius: '4px' } as any },
          }] : [],
        },
        { top: '80%', height: '20%', opposite: true, gridLineWidth: 0, labels: { enabled: false }, title: { text: undefined }, visible: hasVol },
      ],
      plotOptions: {
        series: {
          animation: false, dataGrouping: { enabled: false }, marker: { enabled: false }, states: { hover: { lineWidthPlus: 0 }, inactive: { opacity: 1 } },
          point: { events: { mouseOver(this: any) { setHover(this.index); } } },
          events: { mouseOut() { setHover(null); } },
        },
        candlestick: { pointPadding: 0.15 },
      },
      series: [
        priceSeries,
        ...(hasVol ? [{
          type: 'column', name: 'Volume', yAxis: 1, borderWidth: 0, enableMouseTracking: false,
          data: candles.map(k => ({ x: k.t, y: k.v, color: k.c >= k.o ? `${upColor}73` : `${downColor}73` })),
        } as Highcharts.SeriesOptionsType] : []),
        ...MA.filter(m => mas[m.k]).map(m => ({
          type: 'sma', linkedTo: 'price', params: { period: m.k }, color: m.color, lineWidth: 1.6, marker: { enabled: false }, enableMouseTracking: false,
        } as any)),
      ],
    };
  }, [candles, effType, mas, symbol, upColor, downColor, grid, muted, brand]);

  const shownIdx = hover != null && hover < candles.length ? hover : candles.length - 1;
  const k = candles[shownIdx];
  const prev = shownIdx > 0 ? candles[shownIdx - 1].c : k?.o;
  const chg = k && prev ? k.c - prev : 0;
  const ivLabel = t(IVS.find(x => x.k === iv)!.key as any);
  const title = macro ? `${MACRO_NAME[symbol]} · ${ivLabel}`
    : `${symbol} / ${source?.source === 'binance' ? 'USDT' : 'KRW'} · ${ivLabel} · ${source?.source === 'binance' ? 'Binance' : 'Upbit'}`;

  return (
    <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '18px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: 2.5, py: 2, borderBottom: open ? 1 : 0, borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap' }}>{t('pc.title')}</Typography>
        <Select size="small" value={symbol} onChange={e => onSymbol(e.target.value)}
          sx={{ height: 40, minWidth: 180, borderRadius: '10px', bgcolor: 'ui.pill.bg', fontSize: 15, fontWeight: 800, '& fieldset': { borderColor: 'divider' } }}>
          {coins.map(c => <MenuItem key={c.symbol} value={c.symbol} sx={{ fontSize: 14 }}>{c.symbol}{c.onBinance ? 'USDT · Binance' : 'KRW · Upbit'}</MenuItem>)}
          {MACRO_SYMBOLS.map(m => <MenuItem key={m} value={m} sx={{ fontSize: 14 }}>{MACRO_NAME[m]}</MenuItem>)}
        </Select>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={open ? t('home.chartHide') : t('home.chartShow')}>
          <Box component="button" type="button" onClick={onToggle} aria-expanded={open} sx={{
            width: 32, height: 32, p: 0, border: 0, borderRadius: '50%', bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transform: open ? 'none' : 'rotate(180deg)', transition: 'transform .2s',
            '&:hover': { bgcolor: 'ui.pill.bg', color: 'text.primary' },
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><polyline points="3,9 7,5 11,9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Box>
        </Tooltip>
      </Stack>
      {open && (
        <>
          <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1.25} sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Seg>{IVS.map(x => <Box key={x.k} component="button" type="button" onClick={() => setIv(x.k)} aria-pressed={iv === x.k} sx={segBtn(iv === x.k)}>{t(x.key as any)}</Box>)}</Seg>
            <Sep />
            <Seg>
              {(['candle', 'line', 'area'] as ChartType[]).map(ty => (
                <Box key={ty} component="button" type="button" onClick={() => setType(ty)} aria-pressed={effType === ty} disabled={closeOnly && ty === 'candle'}
                  sx={{ ...segBtn(effType === ty), '&:disabled': { opacity: 0.4, cursor: 'default' } }}>{t(`pc.type.${ty}` as any)}</Box>
              ))}
            </Seg>
            <Sep />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{t('pc.indicators')}</Typography>
            {MA.map(m => (
              <Box key={m.k} component="button" type="button" onClick={() => setMas(cur => ({ ...cur, [m.k]: !cur[m.k] }))} aria-pressed={!!mas[m.k]} sx={{
                display: 'flex', alignItems: 'center', gap: 0.75, height: 30, px: 1.375, borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                border: 1, borderColor: mas[m.k] ? m.color : 'divider', bgcolor: mas[m.k] ? 'ui.pill.bg' : 'background.paper', color: 'text.primary',
              }}>
                <Box sx={{ width: 12, height: 3, borderRadius: 1, bgcolor: m.color }} />MA {m.k}
              </Box>
            ))}
          </Stack>
          {/* 마우스를 올린 봉(없으면 마지막 봉)의 시·고·저·종 */}
          <Stack direction="row" flexWrap="wrap" alignItems="center" columnGap={1.75} rowGap={0.75} sx={{ px: 2.5, pt: 1.75, fontSize: 13.5 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ fontSize: 15, fontWeight: 800 }}>
              {macro ? <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#5b6472', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{symbol[0]}</Box>
                : <CoinIcon symbol={symbol} size={22} />}
              {title}
            </Stack>
            {k && !closeOnly && (['o', 'h', 'l', 'c'] as const).map(key => (
              <Stack key={key} direction="row" gap={0.5}>
                <Box component="span" sx={{ color: 'text.secondary' }}>{t(`pc.ohlc.${key}` as any)}</Box>
                <Box component="span" sx={{ fontWeight: 700, color: k.c >= k.o ? upColor : downColor, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(k[key])}</Box>
              </Stack>
            ))}
            {k && closeOnly && <Box component="span" sx={{ fontWeight: 700 }}>{fmtNum(k.c)}</Box>}
            {k && prev ? (
              <Box component="span" sx={{ fontWeight: 800, color: chg >= 0 ? upColor : downColor, fontVariantNumeric: 'tabular-nums' }}>
                {chg >= 0 ? '+' : ''}{fmtNum(chg)} ({chg >= 0 ? '+' : ''}{((chg / prev) * 100).toFixed(2)}%)
              </Box>
            ) : null}
            {k && k.v > 0 && <Box component="span" sx={{ color: 'text.secondary' }}>{t('pc.volume')} <Box component="b" sx={{ color: 'text.primary' }}>{fmtVol(k.v)}</Box></Box>}
          </Stack>
          <Box sx={{ position: 'relative', px: 1, minHeight: 400 }}>
            {error && !candles.length ? (
              <Typography sx={{ py: 10, textAlign: 'center', color: 'text.secondary', fontSize: 14 }}>{t('pc.noData')}</Typography>
            ) : (
              <HighchartsReact highcharts={Highcharts} constructorType="stockChart" options={options} immutable />
            )}
            {loading && !candles.length && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', fontSize: 22 }}>◆</Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export default PriceChart;
