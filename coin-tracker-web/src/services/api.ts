import axios from 'axios';
import { TimeFrame } from '../components/PriceChart';

export interface HistoryPrice {
  timestamp: string;
  price: number;
}

export async function getHistoryPrices(symbol: string, timeFrame: TimeFrame): Promise<HistoryPrice[]> {
  const res = await axios.get(`/api/history`, {
    params: { symbol, timeFrame },
  });
  return res.data as HistoryPrice[];
} 