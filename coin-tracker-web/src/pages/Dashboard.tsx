import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, Box, Stack } from '@mui/material';
import PriceChart, { TimeFrame, ChartType } from '../components/PriceChart';
import CoinSelector from '../components/CoinSelector';
import SocketService from '../services/socket';
import { getHistoryPrices } from '../services/api';

interface ChartConfig {
  symbol: string;
  timeFrame: TimeFrame;
  chartType: ChartType;
}

const DEFAULT_TIMEFRAME: TimeFrame = '1m';
const DEFAULT_CHART_TYPE: ChartType = 'line';

const Dashboard: React.FC = () => {
  // 차트 설정 배열 (BTCUSDT는 기본으로 포함)
  const [charts, setCharts] = useState<ChartConfig[]>([
    { symbol: 'BTCUSDT', timeFrame: DEFAULT_TIMEFRAME, chartType: DEFAULT_CHART_TYPE }
  ]);
  
  // 각 차트의 데이터 저장
  const [priceDataMap, setPriceDataMap] = useState<{ 
    [key: string]: { timestamp: string; price: number; }[] 
  }>({});
  
  // 데이터 로딩 상태 추적
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  
  const socketRef = useRef<any>(null);

  // Socket.IO 연결 및 구독 관리
  useEffect(() => {
    const socketService = SocketService.getInstance();
    const socket = socketService.connect();
    socketRef.current = socket;

    // 서버에서 실시간 데이터 수신
    socket.on('price_update', (payload: { symbol: string; timeFrame: TimeFrame; price: number; timestamp: string }) => {
      const key = `${payload.symbol}-${payload.timeFrame}`;
      setPriceDataMap(prev => {
        const prevData = prev[key] || [];
        const newData = [...prevData.slice(1), { price: payload.price, timestamp: payload.timestamp }];
        return {
          ...prev,
          [key]: newData,
        };
      });
    });

    return () => {
      socket.off('price_update');
    };
  }, []);

  // 차트 구독 요청
  useEffect(() => {
    const socket = socketRef.current;
    charts.forEach(chart => {
      socket?.emit('subscribe', { symbol: chart.symbol, timeFrame: chart.timeFrame });
    });
  }, [charts]);

  // Mock 데이터 업데이트 (실제 데이터 없을 때만)
  useEffect(() => {
    const interval = setInterval(() => {
      setPriceDataMap(prev => {
        const updated = { ...prev };
        charts.forEach(chart => {
          const key = `${chart.symbol}-${chart.timeFrame}`;
          const prevData = prev[key];
          // 데이터가 있고 실시간 업데이트가 필요한 경우에만 mock 업데이트
          if (prevData && prevData.length > 0) {
            updated[key] = [...prevData.slice(1), {
              timestamp: new Date().toISOString(),
              price: Math.random() * 1000 + 20000,
            }];
          }
        });
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [charts]);

  // 과거 데이터 fetch - 의존성 배열에서 priceDataMap 제거
  useEffect(() => {
    const fetchData = async () => {
      for (const chart of charts) {
        const key = `${chart.symbol}-${chart.timeFrame}`;
        
        // 이미 데이터가 있거나 로딩 중이면 건너뛰기
        if (priceDataMap[key]?.length > 0 || loadingKeys.has(key)) continue;
        
        // 로딩 상태 설정
        setLoadingKeys(prev => new Set(prev).add(key));
        
        try {
          console.log(`API 호출 시작: ${chart.symbol} - ${chart.timeFrame}`);
          const history = await getHistoryPrices(chart.symbol, chart.timeFrame);
          console.log(`API 응답 받음: ${chart.symbol}`, history?.length || 0, '개 데이터');
          
          if (history && history.length > 0) {
            setPriceDataMap(prev => ({
              ...prev,
              [key]: history,
            }));
          } else {
            // 빈 데이터도 설정하여 재호출 방지
            setPriceDataMap(prev => ({
              ...prev,
              [key]: [],
            }));
          }
        } catch (e) {
          console.error(`API 호출 실패: ${chart.symbol}`, e);
          setPriceDataMap(prev => ({
            ...prev,
            [key]: [],
          }));
        } finally {
          // 로딩 상태 해제
          setLoadingKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        }
      }
    };

    fetchData();
  }, [charts]); // priceDataMap과 loadingKeys 제거

  // 새 차트 추가
  const handleAddChart = async (symbol: string) => {
    const newChart: ChartConfig = {
      symbol,
      timeFrame: DEFAULT_TIMEFRAME,
      chartType: DEFAULT_CHART_TYPE,
    };
    
    // 이미 같은 종목이 있는지 확인
    const exists = charts.some(chart => chart.symbol === symbol);
    if (!exists) {
      setCharts(prev => [...prev, newChart]);
      
      // API에서 데이터 가져오기는 useEffect에서 자동으로 처리됨
    }
  };

  // 차트 닫기 (BTCUSDT 제외)
  const handleCloseChart = (symbol: string) => {
    if (symbol === 'BTCUSDT') return; // BTCUSDT는 닫을 수 없음
    
    setCharts(prev => prev.filter(chart => chart.symbol !== symbol));
    
    // 해당 차트의 모든 데이터 삭제
    setPriceDataMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (key.startsWith(`${symbol}-`)) {
          delete updated[key];
        }
      });
      return updated;
    });
  };

  // 시간 단위 변경
  const handleTimeFrameChange = async (symbol: string, newTimeFrame: TimeFrame) => {
    setCharts(prev => prev.map(chart => 
      chart.symbol === symbol 
        ? { ...chart, timeFrame: newTimeFrame }
        : chart
    ));
    
    // 새로운 시간 단위의 데이터 가져오기는 useEffect에서 자동으로 처리됨
  };

  // 차트 타입 변경
  const handleChartTypeChange = (symbol: string, newChartType: ChartType) => {
    setCharts(prev => prev.map(chart => 
      chart.symbol === symbol 
        ? { ...chart, chartType: newChartType }
        : chart
    ));
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* 헤더 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Crypto Tracker Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          실시간 암호화폐 가격 추적 및 분석
        </Typography>
      </Paper>

      {/* 종목 선택기 */}
      <CoinSelector onSymbolSelect={handleAddChart} />

      {/* 차트들 */}
      <Stack spacing={3}>
        {charts.map(chart => {
          const dataKey = `${chart.symbol}-${chart.timeFrame}`;
          const isLoading = loadingKeys.has(dataKey);
          return (
            <PriceChart
              key={`${chart.symbol}-${chart.timeFrame}-${chart.chartType}`}
              data={priceDataMap[dataKey] || []}
              symbol={chart.symbol}
              timeFrame={chart.timeFrame}
              chartType={chart.chartType}
              onTimeFrameChange={(tf) => handleTimeFrameChange(chart.symbol, tf)}
              onChartTypeChange={(ct) => handleChartTypeChange(chart.symbol, ct)}
              onClose={chart.symbol !== 'BTCUSDT' ? () => handleCloseChart(chart.symbol) : undefined}
            />
          );
        })}
      </Stack>
    </Box>
  );
};

export default Dashboard; 