import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ExchangeTickers, TickerExchange } from '../services/market';
import { EXCHANGES } from './exchanges';
import { useSelectedCoins } from './selectedCoins';
import { useTickers } from './useTickers';
import { REF } from './vsRef';

type Tickers = Partial<Record<TickerExchange, ExchangeTickers>>;

interface SharedTickersValue {
  data: Tickers;
  /** 시세가 필요한 화면 수를 늘리고 줄인다 (0이면 받아 오지 않는다) */
  acquire: () => () => void;
}

const ALL_EXCHANGES = EXCHANGES.map(e => e.id);
const Ctx = createContext<SharedTickersValue>({ data: {}, acquire: () => () => {} });

/**
 * 선택한 코인(+BTC)의 거래소별 시세를 한곳에서 받아 홈과 Tools 패널이 함께 쓴다.
 * 필요한 화면(홈, 열린 Tools 패널, 등록된 김프 알림)이 하나라도 있을 때만 3초마다 받아 온다.
 */
export const SharedTickersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { coins } = useSelectedCoins();
  const [users, setUsers] = useState(0);
  // CIM은 알트코인을 BTC 대비로 그리므로, BTC를 선택하지 않아도 BTC 시세는 함께 받는다
  const tickerCoins = useMemo(() => (users > 0 ? Array.from(new Set([REF, ...coins])) : []), [users, coins]);
  const data = useTickers(ALL_EXCHANGES, tickerCoins, 3000);
  const acquire = useCallback(() => {
    setUsers(n => n + 1);
    return () => setUsers(n => n - 1);
  }, []);
  const value = useMemo(() => ({ data, acquire }), [data, acquire]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/** 공유 시세. enabled가 true인 동안 시세를 받아 오게 한다 */
export const useSharedTickers = (enabled = true): Tickers => {
  const { data, acquire } = useContext(Ctx);
  useEffect(() => (enabled ? acquire() : undefined), [enabled, acquire]);
  return data;
};
