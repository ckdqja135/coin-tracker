import React, { createContext, useContext, useState } from 'react';
import { storage } from './chartUtils';

interface SelectedCoinsValue {
  coins: string[];
  add: (coin: string) => void;
  remove: (coin: string) => void;
  clear: () => void;
  /** 상단 티커 바에 표시 중인 코인 */
  active: string;
  setActive: (coin: string) => void;
}

const MAX_COINS = 10;
const Ctx = createContext<SelectedCoinsValue | null>(null);

/** 홈에서 선택한 코인 목록 (티커 바, 비교표, CIM이 공유) */
export const SelectedCoinsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [coins, setCoins] = useState<string[]>(() => storage.get('selectedCoins', ['BTC']));
  const [active, setActive] = useState<string>(() => coins[0] ?? 'BTC');

  const save = (next: string[]) => {
    setCoins(next);
    storage.set('selectedCoins', next);
  };

  const value: SelectedCoinsValue = {
    coins,
    add: coin => {
      const c = coin.toUpperCase();
      if (!coins.includes(c)) save([...coins, c].slice(-MAX_COINS));
      setActive(c);
    },
    remove: coin => {
      const next = coins.filter(c => c !== coin);
      save(next);
      if (active === coin) setActive(next[0] ?? 'BTC');
    },
    clear: () => {
      save([]);
      setActive('BTC');
    },
    active,
    setActive,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useSelectedCoins = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('SelectedCoinsProvider missing');
  return v;
};
