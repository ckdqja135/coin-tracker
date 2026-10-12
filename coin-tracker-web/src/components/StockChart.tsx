import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsOfflineExporting from 'highcharts/modules/offline-exporting';

if (typeof Highcharts === 'object') {
  HighchartsExporting(Highcharts);
  HighchartsOfflineExporting(Highcharts);
  Highcharts.setOptions({
    lang: { thousandsSep: ',' },
    time: { useUTC: false },
    colors: ['#f7931a', '#4fc3f7', '#ab47bc', '#66bb6a', '#ef5350', '#ffca28', '#26a69a', '#8d6e63'],
  });
}

const AXIS_STYLE = { color: '#8a94a3', fontSize: '11px' };
const GRID = 'rgba(128,138,155,0.18)';
const LINE = 'rgba(128,138,155,0.35)';

/** 다크 테마 기본 옵션. 페이지별 옵션과 얕게 병합된다. */
export const baseOptions = (): Highcharts.Options => ({
  chart: {
    backgroundColor: 'transparent',
    style: { fontFamily: 'inherit' },
    height: 480,
    spacing: [10, 4, 10, 4],
  },
  credits: { enabled: false },
  exporting: { enabled: false, fallbackToExportServer: false, chartOptions: { chart: { backgroundColor: '#ffffff' } } },
  rangeSelector: { enabled: false },
  navigator: {
    enabled: true,
    height: 36,
    maskFill: 'rgba(79,195,247,0.12)',
    outlineColor: LINE,
    xAxis: { gridLineColor: GRID, labels: { style: AXIS_STYLE } },
    series: { color: '#4fc3f7', lineColor: '#4fc3f7' } as any,
  },
  scrollbar: { enabled: false },
  legend: { enabled: true, itemStyle: { color: '#d7dde6', fontWeight: '500' }, itemHoverStyle: { color: '#fff' } },
  xAxis: { lineColor: LINE, tickColor: LINE, labels: { style: AXIS_STYLE }, crosshair: { color: '#5b6677', dashStyle: 'Dash' } },
  tooltip: {
    split: false,
    shared: true,
    backgroundColor: 'rgba(17,22,31,0.95)',
    borderColor: LINE,
    style: { color: '#e6ebf2' },
    xDateFormat: '%Y-%m-%d %H:%M',
  },
  plotOptions: {
    series: { dataGrouping: { enabled: false }, animation: false, marker: { enabled: false } },
    candlestick: { color: '#ef5350', upColor: '#26a69a', lineColor: '#ef5350', upLineColor: '#26a69a' },
  },
});

/** 기본 y축 스타일 */
export const yAxis = (opts: Highcharts.YAxisOptions = {}): Highcharts.YAxisOptions => ({
  gridLineColor: GRID,
  labels: { style: AXIS_STYLE, align: 'left', x: 6 },
  title: { text: undefined },
  opposite: true,
  ...opts,
});

export interface StockChartHandle {
  capture: (filename: string) => void;
}

interface Props {
  options: Highcharts.Options;
  /** 항상 어두운 배경 위에 그리는 차트 (테마와 무관하게 밝은 범례) */
  dark?: boolean;
}

const StockChart = forwardRef<StockChartHandle, Props>(({ options, dark }, ref) => {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const theme = useTheme();
  // 범례 글자색은 라이트/다크 테마에 맞춘다
  const themed = useMemo<Highcharts.Options>(() => ({
    ...options,
    legend: options.legend?.enabled === false ? options.legend : {
      ...options.legend,
      itemStyle: { ...(options.legend?.itemStyle ?? {}), color: dark ? '#d7dde6' : theme.palette.text.primary },
      itemHoverStyle: { color: theme.palette.primary.main },
    },
  }), [options, dark, theme.palette.text.primary, theme.palette.primary.main]);

  useImperativeHandle(ref, () => ({
    capture: (filename: string) => {
      chartRef.current?.chart.exportChartLocal({ type: 'image/png', filename }, {});
    },
  }));

  return (
    <HighchartsReact
      ref={chartRef}
      highcharts={Highcharts}
      constructorType="stockChart"
      options={themed}
      immutable
    />
  );
});

export default StockChart;
