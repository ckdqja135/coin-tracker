import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Paper, Typography, Box, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

interface PriceData {
  timestamp: string;
  price: number;
}

export type TimeFrame = '1m' | '5m' | '1h' | '1d' | '1M';

interface PriceChartProps {
  data: PriceData[];
  symbol: string;
  timeFrame: TimeFrame;
  onTimeFrameChange: (tf: TimeFrame) => void;
}

const timeFrameLabels: { label: string; value: TimeFrame }[] = [
  { label: '1분', value: '1m' },
  { label: '5분', value: '5m' },
  { label: '1시간', value: '1h' },
  { label: '1일', value: '1d' },
  { label: '1개월', value: '1M' },
];

function getTimeFormat(timeFrame: TimeFrame) {
  switch (timeFrame) {
    case '1d':
      return '{value:%m-%d}';
    case '1h':
      return '{value:%H:%M}';
    case '5m':
    case '1m':
      return '{value:%H:%M}';
    default:
      return '{value:%H:%M}';
  }
}

const PriceChart: React.FC<PriceChartProps> = ({ data, symbol, timeFrame, onTimeFrameChange }) => {
  // 데이터 검증 및 기본값 설정
  const validData = Array.isArray(data) ? data : [];
  
  const chartOptions: any = {
    chart: {
      type: 'line',
      zoomType: undefined, // 드래그 줌 비활성화
      panning: {
        enabled: true,
        type: 'x'
      },
      panKey: undefined, // Shift 키 없이도 패닝 가능
      events: {
        // 차트 로드 시 마우스 이벤트 설정
        load: function() {
          const chart = this as any;
          
          // 마우스 휠 이벤트로 줌인/줌아웃
          chart.container.onwheel = function(e: any) {
            e.preventDefault();
            
            const xAxis = chart.xAxis[0];
            const extremes = xAxis.getExtremes();
            const range = extremes.max - extremes.min;
            
            // 마우스 위치를 중심으로 줌
            const mouseX = e.offsetX;
            const plotLeft = chart.plotLeft;
            const plotWidth = chart.plotWidth;
            const relativeX = (mouseX - plotLeft) / plotWidth;
            const mouseTime = extremes.min + (extremes.max - extremes.min) * relativeX;
            
            // 휠 방향에 따라 줌 팩터 결정
            const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8; // 아래로 = 줌아웃, 위로 = 줌인
            const newRange = range * zoomFactor;
            
            // 마우스 위치를 중심으로 새로운 범위 계산
            const newMin = mouseTime - newRange * relativeX;
            const newMax = mouseTime + newRange * (1 - relativeX);
            
            xAxis.setExtremes(newMin, newMax, true, false);
          };
        }
      }
    },
    title: {
      text: `${symbol} Price Chart`,
    },
    xAxis: {
      type: 'datetime',
      labels: {
        rotation: -45,
      },
      crosshair: true,
      tickPixelInterval: 100,
      dateTimeLabelFormats: {
        millisecond: '%H:%M:%S',
        second: '%H:%M:%S',
        minute: '%H:%M',
        hour: '%H:%M',
        day: '%m-%d',
        week: '%m-%d',
        month: '%Y-%m',
        year: '%Y'
      },
    },
    yAxis: {
      title: {
        text: 'Price',
      },
    },
    tooltip: {
      xDateFormat: timeFrame === '1d' ? '%Y-%m-%d' : '%Y-%m-%d %H:%M',
      shared: true,
      valueDecimals: 2,
      pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>${point.y}</b><br/>',
    },
    plotOptions: {
      series: {
        marker: {
          enabled: true,
          radius: 2,
        },
        turboThreshold: 0, // 대용량 데이터 처리 개선
      },
    },
    navigation: {
      mouseWheelSensitivity: 1.1, // 휠 감도 조정
    },
    series: [{
      name: symbol,
      type: 'line',
      data: validData.map(item => {
        const timestamp = new Date(item.timestamp).getTime();
        const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
        return [timestamp, price];
      }),
    }],
    credits: {
      enabled: false,
    },
    responsive: {
      rules: [{
        condition: {
          maxWidth: 500
        },
        chartOptions: {
          legend: {
            enabled: false
          }
        }
      }]
    },
  };

  return (
    <Paper sx={{ p: 2, height: 440 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {symbol} Price Chart
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>시간 단위</InputLabel>
          <Select
            value={timeFrame}
            onChange={(e) => onTimeFrameChange(e.target.value as TimeFrame)}
            label="시간 단위"
          >
            {timeFrameLabels.map(tf => (
              <MenuItem key={tf.value} value={tf.value}>
                {tf.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ width: '100%', height: 360 }}>
        {validData.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: 'text.secondary'
          }}>
            <Typography>데이터를 로딩 중입니다...</Typography>
          </Box>
        ) : (
          <HighchartsReact
            highcharts={Highcharts}
            options={chartOptions}
          />
        )}
      </Box>
    </Paper>
  );
};

export default PriceChart; 