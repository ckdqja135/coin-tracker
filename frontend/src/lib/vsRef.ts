/** 알트코인 등락률의 기준 코인 */
export const REF = 'BTC';
/** 상승 / 하락 색 */
export const UP = '#26a69a';
export const DOWN = '#ef5350';

/** 기준 코인 대비 상대 등락률(%). pct·refPct는 같은 기준 시점 대비 등락률(%) */
export const relVsRef = (pct: number, refPct: number) => ((1 + pct / 100) / (1 + refPct / 100) - 1) * 100;
