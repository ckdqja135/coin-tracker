import { calcArb } from './ArbCalc';

// axios(ESM)를 불러오지 않도록 API 모듈은 비운다
jest.mock('../services/market', () => ({ fetchNotices: jest.fn(), fetchWallet: jest.fn() }));

const base = { amount: 1_000_000, buyUsd: true, sellUsd: false, fx: 1000, buyFee: 0, sellFee: 0, withdrawFee: 0 };

describe('calcArb', () => {
  it('수수료가 없으면 수익률 = 가격 차이', () => {
    // 바이낸스 $100 (= ₩100,000), 업비트 ₩103,000 → 3%
    const r = calcArb({ ...base, buyPrice: 100, sellPrice: 103_000 })!;
    expect(r.gap).toBeCloseTo(3);
    expect(r.qty).toBeCloseTo(10);
    expect(r.pct).toBeCloseTo(3);
    expect(r.profit).toBeCloseTo(30_000);
  });

  it('매수·매도 수수료와 출금 수수료를 뺀다', () => {
    const r = calcArb({ ...base, buyPrice: 100, sellPrice: 103_000, buyFee: 0.1, sellFee: 0.05, withdrawFee: 0.01 })!;
    const qty = 10 * 0.999;
    expect(r.qty).toBeCloseTo(qty);
    expect(r.received).toBeCloseTo((qty - 0.01) * 103_000 * 0.9995);
  });

  it('출금 수수료가 산 수량보다 크거나 값이 잘못되면 null', () => {
    expect(calcArb({ ...base, buyPrice: 100, sellPrice: 103_000, withdrawFee: 10 })).toBeNull();
    expect(calcArb({ ...base, amount: NaN, buyPrice: 100, sellPrice: 103_000 })).toBeNull();
    expect(calcArb({ ...base, buyPrice: 0, sellPrice: 103_000 })).toBeNull();
  });
});
