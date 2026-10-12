import React, { forwardRef, useImperativeHandle, useRef } from 'react';
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

const AXIS_STYLE = { color: '#9aa4b2', fontSize: '11px' };

/** 다크 테마 기본 옵션. 페이지별 옵션과 얕게 병합된다. */
export const baseOptions = (): Highcharts.Options => ({
  chart: {
    backgroundColor: 'transparent',
    style: { fontFamily: 'inherit' },
    height: 480,
    spacing: [10, 4, 10, 4],
  },
  credits: { enabled: false },
  exporting: { enabled: false, fallbackToExportServer: false, chartOptions: { chart: { backgroundColor: '#11161f' } } },
  rangeSelector: { enabled: false },
  navigator: {
    enabled: true,
    height: 36,
    maskFill: 'rgba(79,195,247,0.12)',
    outlineColor: '#2a3342',
    xAxis: { gridLineColor: '#1d2430', labels: { style: AXIS_STYLE } },
    series: { color: '#4fc3f7', lineColor: '#4fc3f7' } as any,
  },
  scrollbar: { enabled: false },
  legend: { enabled: true, itemStyle: { color: '#d7dde6', fontWeight: '500' }, itemHoverStyle: { color: '#fff' } },
  xAxis: { lineColor: '#2a3342', tickColor: '#2a3342', labels: { style: AXIS_STYLE }, crosshair: { color: '#5b6677', dashStyle: 'Dash' } },
  tooltip: {
    split: false,
    shared: true,
    backgroundColor: 'rgba(17,22,31,0.95)',
    borderColor: '#2a3342',
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
  gridLineColor: '#1d2430',
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
}

const StockChart = forwardRef<StockChartHandle, Props>(({ options }, ref) => {
  const chartRef = useRef<HighchartsReact.RefObject>(null);

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
      options={options}
      immutable
    />
  );
});

export default StockChart;
