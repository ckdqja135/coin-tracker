import axios from 'axios';
import { TimeFrame } from '../components/PriceChart';

// axios 인스턴스 생성 (백업용)
const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 10000,
});

export interface HistoryPrice {
  timestamp: string;
  price: number;
}

export async function getHistoryPrices(symbol: string, timeFrame: TimeFrame): Promise<HistoryPrice[]> {
  try {
    // 프록시 설정이 있으면 상대 경로 사용, 없으면 절대 경로 사용
    const res = await axios.get(`/api/coin/history`, {
      params: { symbol, timeFrame },
    });
    
    // 백엔드 응답 구조에 맞게 데이터 변환
    if (res.data && res.data.data && Array.isArray(res.data.data)) {
      return res.data.data.map((item: any) => ({
        timestamp: item.timestamp,
        price: parseFloat(item.price || item.close) // 문자열을 숫자로 변환
      }));
    }
    
    return [];
  } catch (error) {
    try {
      // 프록시 실패 시 직접 호출
      console.log('프록시 실패, 직접 API 호출 시도...');
      const res = await apiClient.get(`/api/coin/history`, {
        params: { symbol, timeFrame },
      });
      
      // 백엔드 응답 구조에 맞게 데이터 변환
      if (res.data && res.data.data && Array.isArray(res.data.data)) {
        return res.data.data.map((item: any) => ({
          timestamp: item.timestamp,
          price: parseFloat(item.price || item.close) // 문자열을 숫자로 변환
        }));
      }
      
      return [];
    } catch (fallbackError) {
      console.error('API 호출 실패:', fallbackError);
      return [];
    }
  }
} 