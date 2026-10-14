import React, { useState } from 'react';
import { Box, ButtonBase, InputBase, Stack, Typography } from '@mui/material';
import { useI18n } from '../i18n';
import { EXCHANGES, exchangeMeta } from '../lib/exchanges';
import { DOWN, UP } from '../lib/vsRef';
import { Field, Select, inputBorder } from './toolsUi';
import { ExchangeTickers, TickerExchange } from '../services/market';

// 거래 수수료 기본값(%): 일반 등급 기준. 등급·이벤트에 따라 다르므로 직접 고칠 수 있다
const DEFAULT_FEE: Record<TickerExchange, number> = { upbit: 0.05, bithumb: 0.04, coinone: 0.2, korbit: 0.2, gateio: 0.1, binance: 0.1 };

interface Result { qty: number; received: number; profit: number; pct: number; gap: number }

/**
 * 차익 계산: 원화 amount로 buy 거래소에서 사서 출금 수수료를 빼고 sell 거래소에서 판다.
 * 달러 거래소는 원/달러 환율(fx)로 환산하며, 환전 비용과 송금 시간 동안의 가격 변동은 반영하지 않는다.
 */
export const calcArb = (p: {
  amount: number; buyPrice: number; sellPrice: number; buyUsd: boolean; sellUsd: boolean; fx: number;
  buyFee: number; sellFee: number; withdrawFee: number;
}): Result | null => {
  const { amount, buyPrice, sellPrice, buyUsd, sellUsd, fx, buyFee, sellFee, withdrawFee } = p;
  if (!(amount > 0 && buyPrice > 0 && sellPrice > 0 && fx > 0)) return null;
  const toKrw = (v: number, usd: boolean) => (usd ? v * fx : v);
  const qty = (amount / toKrw(buyPrice, buyUsd)) * (1 - buyFee / 100);
  const arrived = qty - withdrawFee;
  if (arrived <= 0) return null;
  const received = toKrw(arrived * sellPrice, sellUsd) * (1 - sellFee / 100);
  return {
    qty,
    received,
    profit: received - amount,
    pct: (received / amount - 1) * 100,
    // 수수료를 빼기 전 두 거래소 가격 차이(%)
    gap: (toKrw(sellPrice, sellUsd) / toKrw(buyPrice, buyUsd) - 1) * 100,
  };
};

// 쉼표를 넣어 입력해도 숫자로 읽는다
const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/,/g, '')));
const PRESETS = [1e6, 5e6, 1e7, 5e7];

/** 차익 계산기 (Tools 패널의 Arbitrage 탭) */
const ArbCalc: React.FC<{ coins: string[]; tickers: Partial<Record<TickerExchange, ExchangeTickers>> }> = ({ coins, tickers }) => {
  const { t } = useI18n();
  const [coin, setCoin] = useState(coins[0] ?? 'BTC');
  const [buyEx, setBuyEx] = useState<TickerExchange>('binance');
  const [sellEx, setSellEx] = useState<TickerExchange>('upbit');
  const [amount, setAmount] = useState('1000000');
  const [buyFee, setBuyFee] = useState(String(DEFAULT_FEE.binance));
  const [sellFee, setSellFee] = useState(String(DEFAULT_FEE.upbit));
  const [withdrawFee, setWithdrawFee] = useState('0');
  const [showFees, setShowFees] = useState(false);

  const c = coins.includes(coin) ? coin : coins[0];
  const fx = Object.values(tickers).find(x => x?.usdKrw)?.usdKrw ?? null;
  const buyPrice = c ? tickers[buyEx]?.data[c]?.price : undefined;
  const sellPrice = c ? tickers[sellEx]?.data[c]?.price : undefined;
  const r = buyPrice && sellPrice && fx ? calcArb({
    amount: num(amount), buyPrice, sellPrice, fx,
    buyUsd: exchangeMeta(buyEx).currency === 'USD', sellUsd: exchangeMeta(sellEx).currency === 'USD',
    buyFee: num(buyFee) || 0, sellFee: num(sellFee) || 0, withdrawFee: num(withdrawFee) || 0,
  }) : null;

  const exOptions = EXCHANGES.map(e => ({ value: e.id, label: e.label }));
  const pickBuy = (v: TickerExchange) => { setBuyEx(v); setBuyFee(String(DEFAULT_FEE[v])); };
  const pickSell = (v: TickerExchange) => { setSellEx(v); setSellFee(String(DEFAULT_FEE[v])); };
  // 살 곳 ⇄ 팔 곳 (수수료도 함께 바꾼다)
  const swap = () => {
    setBuyEx(sellEx); setSellEx(buyEx);
    setBuyFee(sellFee); setSellFee(buyFee);
  };
  const krw = (v: number) => `₩ ${Math.round(v).toLocaleString('en-US')}`;
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`;
  const color = (v: number) => (v > 0 ? UP : v < 0 ? DOWN : undefined);
  const feeInput = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label} small>
      <InputBase value={value} onChange={e => set(e.target.value)} inputProps={{ inputMode: 'decimal' }}
        sx={{ ...inputBorder, borderRadius: '8px', height: 36, px: 1.2, fontSize: 14 }} />
    </Field>
  );

  return (
    <Stack spacing={1.75} sx={{ p: 2.25 }}>
      {/* 코인 · 살 곳 ⇄ 팔 곳 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr) 36px minmax(0,1fr)', gap: 1, alignItems: 'end' }}>
        <Field label={t('arb.coin')}><Select value={c ?? ''} onChange={setCoin} options={coins.map(x => ({ value: x, label: x }))} /></Field>
        <Field label={t('arb.buyOn')}><Select value={buyEx} onChange={v => pickBuy(v as TickerExchange)} options={exOptions} /></Field>
        <ButtonBase onClick={swap} title={t('arb.swap')} aria-label={t('arb.swap')}
          sx={{ ...inputBorder, height: 40, bgcolor: 'ui.pill.bg', fontSize: 15, color: 'text.secondary', '&:hover': { bgcolor: 'ui.highlight.bg', color: 'primary.main' } }}>⇄</ButtonBase>
        <Field label={t('arb.sellOn')}><Select value={sellEx} onChange={v => pickSell(v as TickerExchange)} options={exOptions} /></Field>
      </Box>

      {/* 금액 */}
      <Stack direction="row" alignItems="center" gap={1} sx={{ ...inputBorder, height: 48, px: 1.5 }}>
        <InputBase value={amount} onChange={e => setAmount(e.target.value)} inputProps={{ inputMode: 'numeric', 'aria-label': t('arb.amount') }}
          sx={{ flex: 1, fontSize: 18, fontWeight: 600, minWidth: 0 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>KRW</Typography>
      </Stack>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        {PRESETS.map(v => (
          <ButtonBase key={v} onClick={() => setAmount(String(v))}
            sx={{ border: 1, borderColor: 'ui.card.border', borderRadius: 99, px: 1.25, py: '5px', fontSize: 12, color: 'text.secondary', fontFamily: 'inherit', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}>
            ₩{v / 1e6}M
          </ButtonBase>
        ))}
      </Stack>

      {/* 수수료 (접힘) */}
      <ButtonBase onClick={() => setShowFees(s => !s)} aria-expanded={showFees}
        sx={{ justifyContent: 'space-between', fontSize: 13, color: 'text.primary', fontFamily: 'inherit', gap: 1 }}>
        <Box component="span" sx={{ fontWeight: 600, flexShrink: 0 }}>{t('arb.fees')}</Box>
        <Box component="span" sx={{ color: 'text.secondary', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'right' }}>
          {t('arb.feeSummary', { buy: buyFee || '0', sell: sellFee || '0', wd: withdrawFee || '0', coin: c ?? '' })}
        </Box>
        <Box component="span" sx={{ color: 'text.secondary', flexShrink: 0 }}>{showFees ? '▴' : '▾'}</Box>
      </ButtonBase>
      {showFees && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 1 }}>
          {feeInput(t('arb.buyFee'), buyFee, setBuyFee)}
          {feeInput(t('arb.sellFee'), sellFee, setSellFee)}
          {feeInput(t('arb.withdrawShort', { coin: c ?? '' }), withdrawFee, setWithdrawFee)}
        </Box>
      )}

      {/* 결과 */}
      <Stack spacing={1.25} sx={{ bgcolor: 'ui.pill.bg', borderRadius: '12px', p: 2 }}>
        {!r ? (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('arb.noPrice')}</Typography>
        ) : (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('arb.estimated')}</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('arb.gapShort')} <b style={{ color: color(r.gap) }}>{signed(r.gap)}</b></Typography>
            </Stack>
            <Stack direction="row" alignItems="baseline" gap={1}>
              <Typography sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: color(r.profit) }}>
                {r.profit > 0 ? '+' : r.profit < 0 ? '−' : ''}{krw(Math.abs(r.profit))}
              </Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: color(r.profit) }}>{signed(r.pct)}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('arb.youReceive')} <Box component="b" sx={{ color: 'text.primary' }}>{krw(r.received)}</Box></Typography>
          </>
        )}
      </Stack>
      <Typography sx={{ fontSize: 11, lineHeight: 1.5, color: 'text.secondary' }}>{t('arb.note')}</Typography>
    </Stack>
  );
};

export default ArbCalc;
