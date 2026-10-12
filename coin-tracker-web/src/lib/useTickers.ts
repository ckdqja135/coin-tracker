import { useEffect, useState } from 'react';
import { ExchangeTickers, TickerExchange, fetchTickers } from '../services/market';

/** 여러 거래소 시세를 주기적으로 폴링한다. 실패한 거래소는 이전 값을 유지한다. */
export const useTickers = (exchanges: TickerExchange[], coins: string[], intervalMs = 3000) => {
  const [data, setData] = useState<Partial<Record<TickerExchange, ExchangeTickers>>>({});
  const exKey = exchanges.join(',');
  const coinKey = coins.join(',');

  useEffect(() => {
    if (!coins.length) {
      setData({});
      return;
    }
    let alive = true;
    const poll = () => {
      exchanges.forEach(ex => {
        fetchTickers(ex, coins)
          .then(r => { if (alive) setData(prev => ({ ...prev, [ex]: r })); })
          .catch(() => { /* 다음 폴링에서 재시도 */ });
      });
    };
    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exKey, coinKey, intervalMs]);

  return data;
};
