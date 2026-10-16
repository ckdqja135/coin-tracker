import Highcharts from 'highcharts/highstock';
import IndicatorsCore from 'highcharts/indicators/indicators';
import Ema from 'highcharts/indicators/ema';
import BollingerBands from 'highcharts/indicators/bollinger-bands';
import Rsi from 'highcharts/indicators/rsi';
import Macd from 'highcharts/indicators/macd';

if (typeof Highcharts === 'object') {
  IndicatorsCore(Highcharts);
  Ema(Highcharts);
  BollingerBands(Highcharts);
  Rsi(Highcharts);
  Macd(Highcharts);
}

/**
 * 차트 상세 화면에서 켜고 끌 수 있는 보조지표.
 * overlay는 원래 값 위에 겹쳐 그리고, 나머지(RSI·MACD)는 아래에 따로 칸을 만든다.
 */
export type IndicatorId = 'ma20' | 'ema50' | 'bb' | 'rsi' | 'macd';
export interface IndicatorDef {
  id: IndicatorId;
  label: string;
  overlay: boolean;
  color: string;
}

export const INDICATORS: IndicatorDef[] = [
  { id: 'ma20', label: 'MA 20', overlay: true, color: '#f7931a' },
  { id: 'ema50', label: 'EMA 50', overlay: true, color: '#ab47bc' },
  { id: 'bb', label: 'Bollinger', overlay: true, color: '#26a69a' },
  { id: 'rsi', label: 'RSI 14', overlay: false, color: '#ec407a' },
  { id: 'macd', label: 'MACD', overlay: false, color: '#00acc1' },
];

/** 지표 칸(RSI·MACD) 하나의 높이(px) */
export const PANE_PX = 130;

/**
 * 고른 지표를 Highcharts 시리즈·축으로 만든다.
 * source: 지표를 계산할 시리즈 id, sourceAxis: 그 시리즈의 y축 번호, firstAxis: 지표 칸이 쓸 첫 y축 번호
 */
export const indicatorSeries = (selected: IndicatorId[], source: string, sourceAxis: number, firstAxis: number) => {
  const panes = INDICATORS.filter(d => !d.overlay && selected.includes(d.id));
  const series: Highcharts.SeriesOptionsType[] = [];
  INDICATORS.filter(d => selected.includes(d.id)).forEach(d => {
    const common = { linkedTo: source, name: d.label, color: d.color, lineWidth: 1, marker: { enabled: false }, enableMouseTracking: true, animation: false };
    const paneAxis = firstAxis + panes.findIndex(p => p.id === d.id);
    switch (d.id) {
      case 'ma20': series.push({ ...common, type: 'sma', yAxis: sourceAxis, params: { period: 20 } } as any); break;
      case 'ema50': series.push({ ...common, type: 'ema', yAxis: sourceAxis, params: { period: 50 } } as any); break;
      case 'bb': series.push({
        ...common, type: 'bb', yAxis: sourceAxis, params: { period: 20, standardDeviation: 2 },
        topLine: { styles: { lineColor: d.color } }, bottomLine: { styles: { lineColor: d.color } }, dashStyle: 'ShortDash',
      } as any); break;
      case 'rsi': series.push({ ...common, type: 'rsi', yAxis: paneAxis, params: { period: 14 } } as any); break;
      case 'macd': series.push({
        ...common, type: 'macd', yAxis: paneAxis, params: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 },
        macdLine: { styles: { lineColor: d.color } }, signalLine: { styles: { lineColor: '#f7931a' } },
      } as any); break;
    }
  });
  return { series, panes };
};
