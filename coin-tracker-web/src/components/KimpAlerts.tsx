import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useI18n } from '../i18n';
import { storage } from '../lib/chartUtils';
import { EXCHANGES } from '../lib/exchanges';
import { DOWN, UP } from '../lib/vsRef';
import { ExchangeTickers, TickerExchange } from '../services/market';

export interface KimpRule { id: string; coin: string; exchange: TickerExchange; op: 'above' | 'below'; value: number }

const KRW_EXCHANGES = EXCHANGES.filter(e => e.currency === 'KRW');
const KEY = 'kimpAlerts';

/** 국내 거래소 원화 가격과 바이낸스 달러 가격 × 환율의 차이(%) */
export const kimpOf = (tickers: Partial<Record<TickerExchange, ExchangeTickers>>, ex: TickerExchange, coin: string): number | null => {
  const krw = tickers[ex]?.data[coin]?.price;
  const usd = tickers.binance?.data[coin]?.price;
  const fx = Object.values(tickers).find(x => x?.usdKrw)?.usdKrw;
  return krw && usd && fx ? (krw / (usd * fx) - 1) * 100 : null;
};

const hits = (r: KimpRule, v: number) => (r.op === 'above' ? v >= r.value : v <= r.value);

/**
 * 김프 알림: 조건을 넘는 순간 브라우저 알림을 띄운다.
 * 조건이 계속 맞는 동안은 다시 울리지 않고, 조건에서 벗어났다가 다시 맞으면 또 울린다.
 * 이 페이지가 열려 있는 동안에만 동작한다 (서버 푸시 없음).
 */
const KimpAlerts: React.FC<{ coins: string[]; tickers: Partial<Record<TickerExchange, ExchangeTickers>> }> = ({ coins, tickers }) => {
  const { t, lang } = useI18n();
  const [rules, setRules] = useState<KimpRule[]>(() => storage.get<KimpRule[]>(KEY, []));
  const [coin, setCoin] = useState(coins[0] ?? 'BTC');
  const [exchange, setExchange] = useState<TickerExchange>('upbit');
  const [op, setOp] = useState<'above' | 'below'>('above');
  const [value, setValue] = useState('3');
  const [fired, setFired] = useState<Record<string, number>>({});
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  // 규칙별 직전 판정 (조건을 "넘는 순간"만 알리기 위해)
  const prev = useRef<Record<string, boolean>>({});

  useEffect(() => storage.set(KEY, rules), [rules]);

  useEffect(() => {
    rules.forEach(r => {
      const v = kimpOf(tickers, r.exchange, r.coin);
      if (v == null) return;
      const now = hits(r, v);
      if (now && !prev.current[r.id]) {
        setFired(f => ({ ...f, [r.id]: Date.now() }));
        const ex = EXCHANGES.find(e => e.id === r.exchange)?.label ?? r.exchange;
        const body = t('alert.body', { coin: r.coin, ex, v: `${v > 0 ? '+' : ''}${v.toFixed(2)}%` });
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(t('alert.title'), { body, tag: r.id });
        } catch { /* 알림 미지원 환경 */ }
      }
      prev.current[r.id] = now;
    });
  }, [tickers, rules, t]);

  const add = async () => {
    const n = Number(value);
    const c = coins.includes(coin) ? coin : coins[0];
    if (!c || !Number.isFinite(n)) return;
    setRules(rs => [...rs, { id: `${Date.now()}`, coin: c, exchange, op, value: n }]);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setPerm(await Notification.requestPermission());
    }
  };
  const remove = (id: string) => {
    setRules(rs => rs.filter(r => r.id !== id));
    delete prev.current[id];
  };

  const field = { size: 'small' as const, sx: { minWidth: 110, flex: 1 }, InputLabelProps: { shrink: true } };

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{t('alert.heading')}</Typography>
        <Tooltip title={t('alert.help')}><Box component="span" sx={{ color: 'text.secondary', cursor: 'help' }}>ⓘ</Box></Tooltip>
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
        <TextField select label={t('arb.coin')} value={coins.includes(coin) ? coin : coins[0] ?? ''} onChange={e => setCoin(e.target.value)} {...field}>
          {coins.map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}
        </TextField>
        <TextField select label={t('alert.exchange')} value={exchange} onChange={e => setExchange(e.target.value as TickerExchange)} {...field}>
          {KRW_EXCHANGES.map(e => <MenuItem key={e.id} value={e.id}>{e.label}</MenuItem>)}
        </TextField>
        <TextField select label={t('alert.when')} value={op} onChange={e => setOp(e.target.value as 'above' | 'below')} {...field}>
          <MenuItem value="above">{t('alert.above')}</MenuItem>
          <MenuItem value="below">{t('alert.below')}</MenuItem>
        </TextField>
        <TextField label={t('alert.value')} value={value} onChange={e => setValue(e.target.value)} type="number" {...field} />
        <Button variant="contained" onClick={add} disabled={!coins.length} sx={{ fontWeight: 700 }}>{t('alert.add')}</Button>
      </Stack>
      {perm === 'denied' && <Typography sx={{ fontSize: 12, color: DOWN, mt: 1 }}>{t('alert.denied')}</Typography>}
      {perm === 'unsupported' && <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>{t('alert.unsupported')}</Typography>}

      <Stack sx={{ mt: 1.5 }}>
        {rules.map(r => {
          const v = kimpOf(tickers, r.exchange, r.coin);
          const on = v != null && hits(r, v);
          const ex = EXCHANGES.find(e => e.id === r.exchange)?.label ?? r.exchange;
          return (
            <Stack key={r.id} direction="row" alignItems="center" gap={1.5} sx={{ py: 0.8, borderBottom: 1, borderColor: 'divider', fontSize: 13 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: on ? UP : 'text.disabled', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 13, flex: 1 }}>
                <b>{r.coin}</b> · {ex} · {t(r.op === 'above' ? 'alert.above' : 'alert.below')} {r.value}%
              </Typography>
              <Typography sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: v == null ? 'text.disabled' : v > 0 ? UP : v < 0 ? DOWN : undefined }}>
                {v == null ? (coins.includes(r.coin) ? '…' : t('alert.notTracked')) : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`}
              </Typography>
              {fired[r.id] && (
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('alert.firedAt', { time: new Date(fired[r.id]).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour12: false }) })}</Typography>
              )}
              <IconButton size="small" onClick={() => remove(r.id)} aria-label={t('alert.remove')}>✕</IconButton>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
};

export default KimpAlerts;
