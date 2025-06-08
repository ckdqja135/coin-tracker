import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Paper, Typography, Box, Tabs, Tab } from '@mui/material';

interface PriceData {
  timestamp: string;
  price: number;
}

export type TimeFrame = '1m' | '5m' | '1h' | '1d';

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
];

function getTickFormatter(timeFrame: TimeFrame) {
  return (tick: string) => {
    // tick이 ISO 문자열 또는 Date 객체로 변환 가능한 값이라고 가정
    const date = new Date(tick);
    if (timeFrame === '1d') {
      // YYYY-MM-DD
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
      return tick;
    }
    // 1m, 5m, 1h: 시:분
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return tick;
  };
}

const PriceChart: React.FC<PriceChartProps> = ({ data, symbol, timeFrame, onTimeFrameChange }) => {
  return (
    <Paper sx={{ p: 2, height: 440 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {symbol} Price Chart
        </Typography>
        <Tabs
          value={timeFrame}
          onChange={(_, v) => onTimeFrameChange(v)}
          textColor="secondary"
          indicatorColor="secondary"
        >
          {timeFrameLabels.map(tf => (
            <Tab key={tf.value} label={tf.label} value={tf.value} />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tickFormatter={getTickFormatter(timeFrame)} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#8884d8"
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default PriceChart; 