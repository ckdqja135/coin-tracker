import React, { useMemo } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { Paper, Typography, Box, Select, MenuItem, FormControl, InputLabel, IconButton } from '@mui/material';

interface PriceData {
  timestamp: string;
  price: number;
}

export type TimeFrame = '1m' | '5m' | '1h' | '1d' | '1M';
export type ChartType = 'line' | 'candlestick' | 'column';

interface PriceChartProps {
  data: PriceData[];
  symbol: string;
  timeFrame: TimeFrame;
  chartType: ChartType;
  onTimeFrameChange: (tf: TimeFrame) => void;
  onChartTypeChange: (ct: ChartType) => void;
  onClose?: () => void; // 차트 닫기 함수 (BTCUSDT는 제외)
}

const timeFrameLabels: { label: string; value: TimeFrame }[] = [
  { label: '1분', value: '1m' },
  { label: '5분', value: '5m' },
  { label: '1시간', value: '1h' },
  { label: '1일', value: '1d' },
  { label: '1개월', value: '1M' },
];

const chartTypeLabels: { label: string; value: ChartType }[] = [
  { label: '라인차트', value: 'line' },
  { label: '캔들차트', value: 'candlestick' },
  { label: '막대차트', value: 'column' },
];

// 실제 캔들스틱 데이터 생성 함수
const generateCandlestickSeries = (data: PriceData[]) => {
  const candleData: any[] = [];
  const volumeData: any[] = [];
  
  data.forEach((item, index) => {
    const timestamp = new Date(item.timestamp).getTime();
    const close = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
    
    // 이전 가격을 open으로 사용
    let open = close;
    if (index > 0) {
      const prevItem = data[index - 1];
      open = typeof prevItem.price === 'string' ? parseFloat(prevItem.price) : prevItem.price;
    }
    
    // 변동성을 추가하여 high, low 생성
    const volatility = close * 0.005; // 0.5% 변동성
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    
    // 캔들스틱 데이터 (OHLC)
    candleData.push([timestamp, open, high, low, close]);
    
    // 가상의 거래량 데이터
    volumeData.push([timestamp, Math.random() * 1000000]);
  });
  
  return { candleData, volumeData };
};

const PriceChart: React.FC<PriceChartProps> = ({ 
  data, 
  symbol, 
  timeFrame, 
  chartType, 
  onTimeFrameChange, 
  onChartTypeChange, 
  onClose 
}) => {
  // 데이터 검증 및 정렬
  const validData = Array.isArray(data) ? 
    data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : 
    [];
  
  // Y축 범위를 계산 (데이터가 있을 때만)
  const yAxisRange = useMemo(() => {
    if (validData.length === 0) return null; // 데이터가 없으면 null 반환
    
    const prices = validData.map(item => typeof item.price === 'string' ? parseFloat(item.price) : item.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange > 0 ? priceRange * 0.05 : maxPrice * 0.05; // 5% 패딩
    
    return {
      min: Math.max(0, minPrice - padding),
      max: maxPrice + padding
    };
  }, [validData.length, symbol, timeFrame]); // validData.length 추가
  
  const chartOptions: any = {
    chart: {
      type: chartType === 'candlestick' ? undefined : chartType,
      zoomType: undefined, // 줌 완전 비활성화
      panning: {
        enabled: true,
        type: 'x'
      },
      panKey: undefined, // Shift 키 없이도 패닝 가능
      resetZoomButton: {
        theme: {
          fill: 'white',
          stroke: 'silver',
          r: 0,
          states: {
            hover: {
              fill: '#41739D',
              style: {
                color: 'white'
              }
            }
          }
        }
      },
      events: {
        // 마우스 휠 줌 기능만 유지
        load: function() {
          const chart = this as any;
          
          // 마우스 휠 이벤트로 줌인/줌아웃
          chart.container.onwheel = function(e: any) {
            e.preventDefault();
            
            const xAxis = chart.xAxis[0];
            const extremes = xAxis.getExtremes();
            const range = extremes.max - extremes.min;
            
            // 최소/최대 범위 제한
            const dataMin = extremes.dataMin;
            const dataMax = extremes.dataMax;
            const totalRange = dataMax - dataMin;
            const minRange = totalRange * 0.05; // 최소 5%
            const maxRange = totalRange; // 최대 100%
            
            if (range <= minRange && e.deltaY < 0) return; // 더 이상 줌인 불가
            if (range >= maxRange && e.deltaY > 0) return; // 더 이상 줌아웃 불가
            
            // 마우스 위치를 중심으로 줌
            const mouseX = e.offsetX;
            const plotLeft = chart.plotLeft;
            const plotWidth = chart.plotWidth;
            const relativeX = Math.max(0, Math.min(1, (mouseX - plotLeft) / plotWidth));
            const mouseTime = extremes.min + (extremes.max - extremes.min) * relativeX;
            
            // 휠 방향에 따라 줌 팩터 결정
            const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
            const newRange = Math.max(minRange, Math.min(maxRange, range * zoomFactor));
            
            // 마우스 위치를 중심으로 새로운 범위 계산
            let newMin = mouseTime - newRange * relativeX;
            let newMax = mouseTime + newRange * (1 - relativeX);
            
            // 데이터 범위를 벗어나지 않도록 조정
            if (newMin < dataMin) {
              newMax += dataMin - newMin;
              newMin = dataMin;
            }
            if (newMax > dataMax) {
              newMin -= newMax - dataMax;
              newMax = dataMax;
            }
            
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
      ordinal: false,
    },
    yAxis: {
      title: {
        text: 'Price',
      },
      // Y축 설정 - 데이터가 있을 때만 고정
      ...(yAxisRange ? {
        min: yAxisRange.min,
        max: yAxisRange.max,
        startOnTick: false,
        endOnTick: false,
        maxPadding: 0,
        minPadding: 0,
      } : {
        // 데이터가 없을 때는 자동 설정
        startOnTick: true,
        endOnTick: true,
      }),
      allowDecimals: true,
    },
    // 하단 네비게이터 바만 유지
    navigator: {
      enabled: true,
      height: 50,
      margin: 10,
      maskFill: 'rgba(102, 133, 194, 0.2)',
      series: {
        type: 'line',
        color: '#4572A7',
        fillOpacity: 0.05,
        lineWidth: 1,
        marker: {
          enabled: false
        }
      },
      xAxis: {
        tickWidth: 0,
        lineWidth: 0,
        gridLineWidth: 1,
        tickPixelInterval: 200,
        labels: {
          style: {
            color: '#888',
            fontSize: '10px'
          }
        }
      },
      yAxis: {
        gridLineWidth: 0,
        startOnTick: false,
        endOnTick: false,
        minPadding: 0.1,
        maxPadding: 0.1,
        labels: {
          enabled: false
        },
        title: {
          text: null
        },
        tickWidth: 0
      }
    },
    // 스크롤바
    scrollbar: {
      enabled: true,
      height: 10,
      trackBorderWidth: 1,
      trackBorderColor: '#CCC',
      trackBackgroundColor: '#F5F5F5',
      buttonBorderWidth: 1,
      buttonBorderColor: '#CCC',
      buttonBackgroundColor: '#E6E6E6'
    },
    // 범위 선택 버튼 제거
    rangeSelector: {
      enabled: false
    },
    tooltip: {
      xDateFormat: timeFrame === '1d' ? '%Y-%m-%d' : '%Y-%m-%d %H:%M',
      shared: true,
      valueDecimals: 2,
      pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b><br/>',
    },
    plotOptions: {
      series: {
        marker: {
          enabled: true,
          radius: 2,
        },
        turboThreshold: 0,
        states: {
          inactive: {
            opacity: 1
          },
          hover: {
            enabled: true,
            lineWidthPlus: 0
          }
        },
        animation: {
          duration: 300
        }
      },
      line: {
        states: {
          inactive: {
            opacity: 1
          },
          hover: {
            lineWidthPlus: 0
          }
        }
      },
      scatter: {
        states: {
          inactive: {
            opacity: 1
          },
          hover: {
            enabled: true
          }
        }
      }
    },
    series: chartType === 'candlestick' ? 
      // 진짜 캔들스틱 차트 구현
      (() => {
        const { candleData } = generateCandlestickSeries(validData);
        
        // 각 캔들을 개별 시리즈로 생성하여 정확한 위치에 배치
        const series: any[] = [];
        
        candleData.forEach(([time, open, high, low, close], index) => {
          const isUp = close >= open;
          const bodyTop = Math.max(open, close);
          const bodyBottom = Math.min(open, close);
          
          // 꼬리(wick) 시리즈 - 고가에서 저가까지
          series.push({
            name: `${symbol}_wick_${index}`,
            type: 'line',
            data: [[time, high], [time, low]],
            color: '#666666',
            lineWidth: 1,
            marker: { enabled: false },
            showInLegend: false,
            enableMouseTracking: false,
            states: {
              inactive: { opacity: 1 },
              hover: { enabled: false }
            }
          });
          
          // 몸통(body) 시리즈 - 시가에서 종가까지
          if (bodyTop !== bodyBottom) {
            series.push({
              name: `${symbol}_body_${index}`,
              type: 'line',
              data: [[time, bodyTop], [time, bodyBottom]],
              color: isUp ? '#ff0000' : '#0000ff',
              lineWidth: 8,
              marker: { enabled: false },
              showInLegend: false,
              enableMouseTracking: false
            });
          }
        });
        
        // 메인 시리즈 (툴팁용)
        series.push({
          name: symbol,
          type: 'scatter',
          data: candleData.map(([time, open, high, low, close]) => ({
            x: time,
            y: close,
            open: open,
            high: high,
            low: low,
            close: close
          })),
          marker: {
            enabled: false
          },
          tooltip: {
            pointFormat: '<span style="color:{point.color}">\u25CF</span> <b>{series.name}</b><br/>' +
              'Open: {point.open:.2f}<br/>' +
              'High: {point.high:.2f}<br/>' +
              'Low: {point.low:.2f}<br/>' +
              'Close: {point.close:.2f}<br/>'
          }
        });
        
        return series;
      })() :
      // 일반 차트용 시리즈
      [{
        name: symbol,
        type: chartType,
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
    <Paper sx={{ p: 2, height: 500 }}> {/* 높이 조정 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {symbol} Price Chart
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* 차트 타입 선택 */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>차트 타입</InputLabel>
            <Select
              value={chartType}
              onChange={(e) => onChartTypeChange(e.target.value as ChartType)}
              label="차트 타입"
            >
              {chartTypeLabels.map(ct => (
                <MenuItem key={ct.value} value={ct.value}>
                  {ct.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* 시간 단위 선택 */}
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
          
          {/* 닫기 버튼 (BTCUSDT 제외) */}
          {onClose && (
            <IconButton 
              onClick={onClose}
              size="small"
              sx={{ 
                color: 'text.secondary',
                '&:hover': { color: 'error.main' }
              }}
            >
              ✕
            </IconButton>
          )}
        </Box>
      </Box>
      <Box sx={{ width: '100%', height: 420 }}> {/* 높이 조정 */}
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