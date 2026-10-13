import React, { createContext, useContext, useState } from 'react';
import { storage } from './chartUtils';
import { REF } from './vsRef';

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

/** 항상 선택되어 있는 코인 (지울 수 없다) */
export const PINNED_COIN = REF;

/** BTC를 맨 앞에 고정하고 중복을 없앤다 (최대 MAX_COINS개, 넘치면 오래된 것부터 뺀다) */
const withPinned = (list: string[]) => [PINNED_COIN, ...Array.from(new Set(list.filter(c => c !== PINNED_COIN))).slice(-(MAX_COINS - 1))];

/** 홈에서 선택한 코인 목록 (티커 바, 비교표, CIM이 공유) */
export const SelectedCoinsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [coins, setCoins] = useState<string[]>(() => withPinned(storage.get<string[]>('selectedCoins', [])));
  const [active, setActive] = useState<string>(() => coins[0] ?? PINNED_COIN);

  const save = (list: string[]) => {
    const next = withPinned(list);
    setCoins(next);
    storage.set('selectedCoins', next);
  };

  const value: SelectedCoinsValue = {
    coins,
    add: coin => {
      const c = coin.toUpperCase();
      if (!coins.includes(c)) save([...coins, c]);
      setActive(c);
    },
    remove: coin => {
      if (coin === PINNED_COIN) return;
      save(coins.filter(c => c !== coin));
      if (active === coin) setActive(PINNED_COIN);
    },
    // 전체 지우기도 BTC는 남긴다
    clear: () => {
      save([]);
      setActive(PINNED_COIN);
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
