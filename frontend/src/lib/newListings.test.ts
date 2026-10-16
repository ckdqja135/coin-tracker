import { NEW_FOR_MS, newListingsOf } from './newListings';
import { Notice } from '../services/market';

// axios(ESM)를 불러오지 않도록 API 모듈은 비운다
jest.mock('../services/market', () => ({ fetchNotices: jest.fn() }));

const n = (p: Partial<Notice>): Notice => ({ exchange: 'upbit', title: '', category: '', kind: 'listing', coins: [], url: '', time: 0, ...p });

describe('newListingsOf', () => {
  const now = 10 * NEW_FOR_MS;

  it('최근 상장 공지만 코인별로 묶고 거래소를 합친다', () => {
    const map = newListingsOf([
      n({ coins: ['ACU'], exchange: 'bithumb', time: now - 1000 }),
      n({ coins: ['ACU'], exchange: 'upbit', time: now - 5000 }),
      n({ coins: ['OLD'], time: now - NEW_FOR_MS - 1 }),
      n({ coins: ['BLAST'], kind: 'delisting', time: now - 1000 }),
      n({ coins: ['ZEST'], kind: 'other', time: now - 1000 }),
    ], now);
    expect(Array.from(map.keys())).toEqual(['ACU']);
    expect(map.get('ACU')).toEqual({ exchanges: ['bithumb', 'upbit'], time: now - 5000 });
  });
});
