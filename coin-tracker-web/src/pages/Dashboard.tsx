import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, Box, TextField, Button, Stack } from '@mui/material';
import PriceChart, { TimeFrame } from '../components/PriceChart';
import SocketService from '../services/socket';
import { getHistoryPrices } from '../services/api';

// Temporary mock data generator
const generateMockData = (timeFrame: TimeFrame) => {
  let interval = 60000; // 1분
  let count = 20;
  if (timeFrame === '5m') { interval = 5 * 60000; count = 20; }
  if (timeFrame === '1h') { interval = 60 * 60000; count = 24; }
  if (timeFrame === '1d') { interval = 24 * 60 * 60000; count = 30; }
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.now() - (count - i) * interval).toLocaleTimeString(),
    price: Math.random() * 1000 + 20000,
  }));
};

const DEFAULT_COINS = ['BTC/USDT'];
const DEFAULT_TIMEFRAME: TimeFrame = '1m';

const Dashboard: React.FC = () => {
  const [coinInput, setCoinInput] = useState('');
  const [coins, setCoins] = useState<string[]>(DEFAULT_COINS);
  const [priceDataMap, setPriceDataMap] = useState<{ [symbol: string]: { [tf in TimeFrame]: { timestamp: string; price: number; }[] } }>(
    {
      'BTC/USDT': {
        '1m': generateMockData('1m'),
        '5m': generateMockData('5m'),
        '1h': generateMockData('1h'),
        '1d': generateMockData('1d'),
      },
    }
  );
  const [timeFrames, setTimeFrames] = useState<{ [symbol: string]: TimeFrame }>({ 'BTC/USDT': DEFAULT_TIMEFRAME });
  const socketRef = useRef<any>(null);

  // Socket.IO 연결 및 구독 관리
  useEffect(() => {
    const socketService = SocketService.getInstance();
    const socket = socketService.connect();
    socketRef.current = socket;

    // 서버에서 실시간 데이터 수신 (이벤트명/데이터 포맷은 서버에 맞게 수정 필요)
    socket.on('price_update', (payload: { symbol: string; timeFrame: TimeFrame; price: number; timestamp: string }) => {
      setPriceDataMap(prev => {
        const { symbol, timeFrame, price, timestamp } = payload;
        const prevData = prev[symbol]?.[timeFrame] || [];
        const newData = [...prevData.slice(1), { price, timestamp }];
        return {
          ...prev,
          [symbol]: {
            ...prev[symbol],
            [timeFrame]: newData,
          },
        };
      });
    });

    return () => {
      socket.off('price_update');
    };
  }, []);

  // 코인/타임프레임 구독 요청
  useEffect(() => {
    const socket = socketRef.current;
    coins.forEach(symbol => {
      const tf = timeFrames[symbol] || DEFAULT_TIMEFRAME;
      socket?.emit('subscribe', { symbol, timeFrame: tf });
    });
    // 구독 해제는 필요시 추가
  }, [coins, timeFrames]);

  // Mock: Update each coin's data every 5 seconds (실제 데이터 없을 때만)
  useEffect(() => {
    const interval = setInterval(() => {
      setPriceDataMap(prev => {
        const updated: typeof prev = { ...prev };
        coins.forEach(symbol => {
          const tf = timeFrames[symbol] || DEFAULT_TIMEFRAME;
          const prevData = prev[symbol]?.[tf] || generateMockData(tf);
          if (!updated[symbol]) updated[symbol] = { '1m': [], '5m': [], '1h': [], '1d': [] };
          // 실시간 데이터가 없을 때만 mock 데이터 추가
          if (!prevData.length || prevData[prevData.length - 1].timestamp === undefined) {
            updated[symbol][tf] = [...prevData.slice(1), {
              timestamp: new Date().toLocaleTimeString(),
              price: Math.random() * 1000 + 20000,
            }];
          }
        });
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [coins, timeFrames]);

  // 코인/타임프레임 변경 시 과거 데이터 fetch
  useEffect(() => {
    coins.forEach(async (symbol) => {
      const tf = timeFrames[symbol] || DEFAULT_TIMEFRAME;
      // 이미 데이터가 있으면 fetch하지 않음
      setPriceDataMap(prev => {
        if (prev[symbol]?.[tf] && prev[symbol][tf].length > 0) return prev;
        return prev;
      });
      try {
        const history = await getHistoryPrices(symbol, tf);
        setPriceDataMap(prev => ({
          ...prev,
          [symbol]: {
            ...prev[symbol],
            [tf]: history,
          },
        }));
      } catch (e) {
        // 에러 시 무시하고 mock 데이터 사용
      }
    });
  }, [coins, timeFrames]);

  // 코인 추가 핸들러
  const handleAddCoin = () => {
    const symbol = coinInput.trim().toUpperCase();
    if (symbol && !coins.includes(symbol)) {
      setCoins(prev => [...prev, symbol]);
      setPriceDataMap(prev => ({
        ...prev,
        [symbol]: {
          '1m': generateMockData('1m'),
          '5m': generateMockData('5m'),
          '1h': generateMockData('1h'),
          '1d': generateMockData('1d'),
        },
      }));
      setTimeFrames(prev => ({ ...prev, [symbol]: DEFAULT_TIMEFRAME }));
    }
    setCoinInput('');
  };

  // 시간 단위 변경 핸들러
  const handleTimeFrameChange = (symbol: string, tf: TimeFrame) => {
    setTimeFrames(prev => ({ ...prev, [symbol]: tf }));
    // 데이터가 없으면 mock 데이터 생성 (REST API fetch가 실패할 때만)
    setPriceDataMap(prev => {
      if (!prev[symbol]?.[tf]) {
        return {
          ...prev,
          [symbol]: {
            ...prev[symbol],
            [tf]: generateMockData(tf),
          },
        };
      }
      return prev;
    });
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* 코인 추가 UI */}
      <Box sx={{ mb: 3 }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Crypto Tracker Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Real-time cryptocurrency price tracking and analysis
          </Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Add Coin Symbol (예: BTC/USDT)"
              variant="outlined"
              size="small"
              value={coinInput}
              onChange={e => setCoinInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCoin(); }}
            />
            <Button variant="contained" onClick={handleAddCoin} disabled={!coinInput.trim()}>
              Add
            </Button>
          </Stack>
        </Paper>
      </Box>
      {/* 여러 코인 차트 렌더링 */}
      <Stack spacing={3}>
        {coins.map(symbol => (
          <PriceChart
            key={symbol}
            data={priceDataMap[symbol]?.[timeFrames[symbol] || DEFAULT_TIMEFRAME] || []}
            symbol={symbol}
            timeFrame={timeFrames[symbol] || DEFAULT_TIMEFRAME}
            onTimeFrameChange={tf => handleTimeFrameChange(symbol, tf)}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default Dashboard; 