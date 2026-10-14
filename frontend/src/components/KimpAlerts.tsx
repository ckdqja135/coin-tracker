import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, InputBase, Stack, Typography } from '@mui/material';
import { useI18n } from '../i18n';
import { storage } from '../lib/chartUtils';
import { EXCHANGES } from '../lib/exchanges';
import { DOWN, UP } from '../lib/vsRef';
import { ExchangeTickers, TickerExchange } from '../services/market';
import { Field, Segmented, Select, inputBorder } from './toolsUi';

export interface KimpRule { id: string; coin: string; exchange: TickerExchange; op: 'above' | 'below'; value: number }
type Tickers = Partial<Record<TickerExchange, ExchangeTickers>>;

const KRW_EXCHANGES = EXCHANGES.filter(e => e.currency === 'KRW');
const KEY = 'kimpAlerts';

/** 국내 거래소 원화 가격과 바이낸스 달러 가격 × 환율의 차이(%) */
export const kimpOf = (tickers: Tickers, ex: TickerExchange, coin: string): number | null => {
  const krw = tickers[ex]?.data[coin]?.price;
  const usd = tickers.binance?.data[coin]?.price;
  const fx = Object.values(tickers).find(x => x?.usdKrw)?.usdKrw;
  return krw && usd && fx ? (krw / (usd * fx) - 1) * 100 : null;
};

const hits = (r: KimpRule, v: number) => (r.op === 'above' ? v >= r.value : v <= r.value);

/** 조건까지 얼마나 왔는지 (0~1). 기준과의 차이가 기준 크기(최소 1%p)만큼 남았으면 0 */
const progressOf = (r: KimpRule, v: number) => {
  if (hits(r, v)) return 1;
  return Math.max(0, Math.min(1, 1 - Math.abs(r.value - v) / Math.max(Math.abs(r.value), 1)));
};

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;

/**
 * 김프 알림 규칙 (localStorage에 저장)과 알림 검사
 * 조건을 넘는 순간 브라우저 알림을 띄운다. 조건이 계속 맞는 동안은 다시 울리지 않고,
 * 조건에서 벗어났다가 다시 맞으면 또 울린다. 사이트가 열려 있는 동안에만 동작한다 (서버 푸시 없음).
 */
export const useKimpAlerts = () => {
  const [rules, setRules] = useState<KimpRule[]>(() => storage.get<KimpRule[]>(KEY, []));
  // 규칙별 직전 판정 (조건을 "넘는 순간"만 알리기 위해)
  const prev = useRef<Record<string, boolean>>({});

  useEffect(() => storage.set(KEY, rules), [rules]);

  const add = (r: Omit<KimpRule, 'id'>) => setRules(rs => [{ ...r, id: `${Date.now()}` }, ...rs]);
  const remove = (id: string) => {
    setRules(rs => rs.filter(r => r.id !== id));
    delete prev.current[id];
  };
  return { rules, add, remove, prev };
};

/** 규칙을 시세와 비교해 조건을 넘는 순간 알린다 */
export const useKimpAlertCheck = (alerts: ReturnType<typeof useKimpAlerts>, tickers: Tickers) => {
  const { t } = useI18n();
  const { rules, prev } = alerts;
  useEffect(() => {
    rules.forEach(r => {
      const v = kimpOf(tickers, r.exchange, r.coin);
      if (v == null) return;
      const now = hits(r, v);
      if (now && !prev.current[r.id]) {
        const ex = EXCHANGES.find(e => e.id === r.exchange)?.label ?? r.exchange;
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(t('alert.title'), { body: t('alert.body', { coin: r.coin, ex, v: signed(v) }), tag: r.id });
          }
        } catch { /* 알림 미지원 환경 */ }
      }
      prev.current[r.id] = now;
    });
  }, [tickers, rules, t, prev]);
};

/** 김프 알림 (Tools 패널의 Premium alerts 탭) */
const KimpAlerts: React.FC<{ coins: string[]; tickers: Tickers; alerts: ReturnType<typeof useKimpAlerts> }> = ({ coins, tickers, alerts }) => {
  const { t } = useI18n();
  const [coin, setCoin] = useState(coins[0] ?? 'BTC');
  const [exchange, setExchange] = useState<TickerExchange>('upbit');
  const [op, setOp] = useState<'above' | 'below'>('above');
  const [value, setValue] = useState('3');
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));

  const c = coins.includes(coin) ? coin : coins[0];
  const exLabel = (id: TickerExchange) => EXCHANGES.find(e => e.id === id)?.label ?? id;
  const current = c ? kimpOf(tickers, exchange, c) : null;
  const color = (v: number | null) => (v == null ? undefined : v > 0 ? UP : v < 0 ? DOWN : undefined);

  const add = async () => {
    const n = Number(value);
    if (!c || !Number.isFinite(n)) return;
    alerts.add({ coin: c, exchange, op, value: n });
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setPerm(await Notification.requestPermission());
    }
  };

  return (
    <Stack spacing={1.75} sx={{ p: 2.25 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr)', gap: 1 }}>
        <Field label={t('arb.coin')}><Select value={c ?? ''} onChange={setCoin} options={coins.map(x => ({ value: x, label: x }))} /></Field>
        <Field label={t('alert.exchange')}>
          <Select value={exchange} onChange={v => setExchange(v as TickerExchange)} options={KRW_EXCHANGES.map(e => ({ value: e.id, label: e.label }))} />
        </Field>
      </Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
        {t('alert.now', { ex: exLabel(exchange) })} <b style={{ color: color(current) }}>{current == null ? '…' : signed(current)}</b> {t('alert.vsBinance')}
      </Typography>

      {/* ≥/≤ · 기준 % · 추가 */}
      <Stack direction="row" gap={1}>
        <Segmented value={op} onChange={setOp} options={[{ value: 'above', label: '≥' }, { value: 'below', label: '≤' }]} />
        <Stack direction="row" alignItems="center" sx={{ ...inputBorder, flex: 1, height: 40, px: 1.25, minWidth: 0 }}>
          <InputBase value={value} onChange={e => setValue(e.target.value)} inputProps={{ inputMode: 'decimal', 'aria-label': t('alert.value') }}
            sx={{ flex: 1, fontSize: 15, fontWeight: 600, minWidth: 0 }} />
          <Typography sx={{ fontWeight: 600, color: 'text.secondary' }}>%</Typography>
        </Stack>
        <Button variant="contained" onClick={add} disabled={!coins.length} disableElevation
          sx={{ height: 40, borderRadius: '10px', fontWeight: 700, px: 2, textTransform: 'none' }}>{t('alert.add')}</Button>
      </Stack>
      {perm === 'denied' && <Typography sx={{ fontSize: 12, color: DOWN }}>{t('alert.denied')}</Typography>}
      {perm === 'unsupported' && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('alert.unsupported')}</Typography>}

      {/* 규칙 목록 */}
      <Stack spacing={0.75} sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
        {alerts.rules.length === 0 && (
          <Typography sx={{ p: 2, textAlign: 'center', fontSize: 13, color: 'text.secondary' }}>{t('alert.empty')}</Typography>
        )}
        {alerts.rules.map(r => {
          const v = kimpOf(tickers, r.exchange, r.coin);
          const on = v != null && hits(r, v);
          return (
            <Box key={r.id} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 24px', alignItems: 'center', gap: 1.25, py: 1, px: 0.25 }}>
              <Stack spacing={0.6} sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={0.75} sx={{ fontSize: 13, fontWeight: 600 }}>
                  <Box title={on ? t('alert.triggered') : t('alert.waiting')}
                    sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: on ? UP : 'text.disabled', flex: 'none' }} />
                  <Box component="span" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.coin} · {exLabel(r.exchange)} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>{r.op === 'above' ? '≥' : '≤'} {r.value.toFixed(2)}%</Box>
                  </Box>
                </Stack>
                <Box sx={{ height: 3, bgcolor: 'ui.pill.bg', borderRadius: 99, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${Math.round((v == null ? 0 : progressOf(r, v)) * 100)}%`, bgcolor: 'primary.main' }} />
                </Box>
              </Stack>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {t('alert.nowShort')} <Box component="b" sx={{ color: 'text.primary' }}>{v == null ? (coins.includes(r.coin) ? '…' : t('alert.notTracked')) : signed(v)}</Box>
              </Typography>
              <IconButton size="small" onClick={() => alerts.remove(r.id)} aria-label={t('alert.remove')}
                sx={{ color: 'text.disabled', fontSize: 16, '&:hover': { color: DOWN } }}>×</IconButton>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
};

export default KimpAlerts;
