import React, { useState } from 'react';
import { Box, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useI18n } from '../i18n';
import { EXCHANGES, exchangeMeta } from '../lib/exchanges';
import { DOWN, UP } from '../lib/vsRef';
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

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

const ArbCalc: React.FC<{ coins: string[]; tickers: Partial<Record<TickerExchange, ExchangeTickers>> }> = ({ coins, tickers }) => {
  const { t } = useI18n();
  const [coin, setCoin] = useState(coins[0] ?? 'BTC');
  const [buyEx, setBuyEx] = useState<TickerExchange>('binance');
  const [sellEx, setSellEx] = useState<TickerExchange>('upbit');
  const [amount, setAmount] = useState('1000000');
  const [buyFee, setBuyFee] = useState(String(DEFAULT_FEE.binance));
  const [sellFee, setSellFee] = useState(String(DEFAULT_FEE.upbit));
  const [withdrawFee, setWithdrawFee] = useState('0');

  const c = coins.includes(coin) ? coin : coins[0];
  const fx = Object.values(tickers).find(x => x?.usdKrw)?.usdKrw ?? null;
  const buyPrice = c ? tickers[buyEx]?.data[c]?.price : undefined;
  const sellPrice = c ? tickers[sellEx]?.data[c]?.price : undefined;
  const r = buyPrice && sellPrice && fx ? calcArb({
    amount: num(amount), buyPrice, sellPrice, fx,
    buyUsd: exchangeMeta(buyEx).currency === 'USD', sellUsd: exchangeMeta(sellEx).currency === 'USD',
    buyFee: num(buyFee) || 0, sellFee: num(sellFee) || 0, withdrawFee: num(withdrawFee) || 0,
  }) : null;

  const field = { size: 'small' as const, sx: { minWidth: 120, flex: 1 }, InputLabelProps: { shrink: true } };
  const exSelect = (label: string, value: TickerExchange, onChange: (v: TickerExchange) => void) => (
    <TextField select label={label} value={value} onChange={e => onChange(e.target.value as TickerExchange)} {...field}>
      {EXCHANGES.map(e => <MenuItem key={e.id} value={e.id}>{e.label}</MenuItem>)}
    </TextField>
  );
  const krw = (v: number) => `₩ ${Math.round(v).toLocaleString('en-US')}`;

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{t('arb.title')}</Typography>
        <Tooltip title={t('arb.help')}><Box component="span" sx={{ color: 'text.secondary', cursor: 'help' }}>ⓘ</Box></Tooltip>
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={1.5}>
        <TextField select label={t('arb.coin')} value={c ?? ''} onChange={e => setCoin(e.target.value)} {...field}>
          {coins.map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}
        </TextField>
        {exSelect(t('arb.buyOn'), buyEx, v => { setBuyEx(v); setBuyFee(String(DEFAULT_FEE[v])); })}
        {exSelect(t('arb.sellOn'), sellEx, v => { setSellEx(v); setSellFee(String(DEFAULT_FEE[v])); })}
        <TextField label={t('arb.amount')} value={amount} onChange={e => setAmount(e.target.value)} type="number" {...field} />
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mt: 1.5 }}>
        <TextField label={t('arb.buyFee')} value={buyFee} onChange={e => setBuyFee(e.target.value)} type="number" {...field} />
        <TextField label={t('arb.sellFee')} value={sellFee} onChange={e => setSellFee(e.target.value)} type="number" {...field} />
        <TextField label={t('arb.withdrawFee', { coin: c ?? '' })} value={withdrawFee} onChange={e => setWithdrawFee(e.target.value)} type="number" {...field} />
      </Stack>

      <Box sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: 'ui.pill.bg' }}>
        {!r && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('arb.noPrice')}</Typography>}
        {r && (
          <Stack direction="row" flexWrap="wrap" columnGap={3} rowGap={1} alignItems="baseline">
            <Typography sx={{ fontSize: 13 }}>{t('arb.gap')} <b style={{ color: r.gap > 0 ? UP : r.gap < 0 ? DOWN : undefined }}>{r.gap > 0 ? '+' : ''}{r.gap.toFixed(2)}%</b></Typography>
            <Typography sx={{ fontSize: 13 }}>{t('arb.received')} <b>{krw(r.received)}</b></Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: r.profit > 0 ? UP : r.profit < 0 ? DOWN : undefined }}>
              {t('arb.profit')} {r.profit > 0 ? '+' : ''}{krw(r.profit)} ({r.pct > 0 ? '+' : ''}{r.pct.toFixed(2)}%)
            </Typography>
          </Stack>
        )}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1 }}>{t('arb.note')}</Typography>
    </Box>
  );
};

export default ArbCalc;
