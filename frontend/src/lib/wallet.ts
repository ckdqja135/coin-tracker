import { useAsync } from './useAsync';
import { WalletData, fetchWallet } from '../services/market';

// 요약·비교표·차익 계산기가 같은 코인 목록으로 부르므로 잠시 결과를 공유한다
const TTL = 60_000;
const cache = new Map<string, { at: number; p: Promise<WalletData> }>();
const load = (key: string) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.p;
  const p = fetchWallet(key.split(',')).catch(e => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), p });
  return p;
};
const EMPTY: WalletData = {};

export { walletOf } from './summary';

/** 코인들의 거래소별 입출금 상태 (모르면 빈 객체) */
export const useWallet = (coins: string[]): WalletData => {
  const key = Array.from(new Set(coins)).sort().join(',');
  return useAsync(() => (key ? load(key) : Promise.resolve(EMPTY)), [key], TTL).data ?? EMPTY;
};
