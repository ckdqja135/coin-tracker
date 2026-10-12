import { correlation, fillRange, sma } from './chartUtils';

const candles = (closes: number[]) => closes.map((c, i) => ({ t: i * 60_000, o: c, h: c, l: c, c, v: 0 }));

describe('sma', () => {
  it('period 동안의 평균을 구하고, 앞쪽 period-1개는 건너뛴다', () => {
    const pts: [number, number][] = [[1, 1], [2, 2], [3, 3], [4, 4]];
    expect(sma(pts, 2)).toEqual([[2, 1.5], [3, 2.5], [4, 3.5]]);
  });

  it('period가 1 이하면 그대로 돌려준다', () => {
    const pts: [number, number][] = [[1, 5], [2, 6]];
    expect(sma(pts, 0)).toBe(pts);
  });
});

describe('correlation', () => {
  it('같은 방향으로 움직이면 1, 반대면 -1에 가깝다', () => {
    // 수익률이 들쭉날쭉해야 상관계수가 정의된다
    const a = candles([100, 102, 101, 105, 103, 108, 106, 110, 107, 112, 111, 115]);
    const same = candles(a.map(k => k.c * 2));
    const opposite = candles(a.map(k => 10_000 / k.c));
    expect(correlation(a, same).r).toBeCloseTo(1, 6);
    expect(correlation(a, opposite).r).toBeCloseTo(-1, 6);
  });

  it('겹치는 구간이 10개 미만이면 계산하지 않는다 (N/A)', () => {
    const a = candles([1, 2, 3, 4, 5]);
    expect(correlation(a, a).r).toBeNull();
  });
});

describe('fillRange', () => {
  const MIN = 60_000;

  it('기간 시작 전 마지막 값으로 시작점을 채운다', () => {
    const pts = [{ t: -5 * MIN, v: 10 }, { t: 5 * MIN, v: 12 }];
    const out = fillRange(pts, 0, 10 * MIN);
    expect(out[0]).toEqual({ t: 0, v: 10 });
  });

  it('장 마감처럼 크게 벌어진 구간은 사선 대신 직전 값으로 평평하게 잇는다', () => {
    const pts = [
      { t: 0, v: 1 }, { t: MIN, v: 2 }, { t: 2 * MIN, v: 3 },
      // 2분 → 60분: 평소 간격(1분)의 3배를 넘는 휴장 구간
      { t: 60 * MIN, v: 9 },
    ];
    const out = fillRange(pts, 0, 60 * MIN);
    // 다음 점 직전까지 직전 값(3)을 유지하는 점이 끼어든다
    expect(out).toContainEqual({ t: 60 * MIN - 1, v: 3 });
  });

  it('마지막 값을 기간 끝까지 늘린다', () => {
    const out = fillRange([{ t: 0, v: 7 }], 0, 10 * MIN);
    expect(out[out.length - 1]).toEqual({ t: 10 * MIN, v: 7 });
  });
});
