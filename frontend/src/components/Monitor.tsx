import React, { useEffect, useState } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Highcharts from 'highcharts/highstock';
import Cim from './Cim';
import CoinIcon from './CoinIcon';
import ExchangeBadge from './ExchangeBadge';
import { loadCoinList } from './CoinSearch';
import { MacroSymbol } from './PriceChart';
import { TKey, useI18n } from '../i18n';
import { EXCHANGES, ExchangeMeta } from '../lib/exchanges';
import { NewBadge, NEW_COLOR, useNewListings, useNotices } from '../lib/newListings';
import { Fact, summarizeCoin, walletStatusOf } from '../lib/summary';
import { useAsync } from '../lib/useAsync';
import { DOWN, REF, UP, relVsRef } from '../lib/vsRef';
import { useWallet } from '../lib/wallet';
import { ExchangeTickers, TickerExchange, fetchOverview } from '../services/market';

export type Currency = 'USD' | 'KRW';
type Tickers = Partial<Record<TickerExchange, ExchangeTickers>>;

/** 거래소 통화 -> 표시 통화 변환 */
export const convert = (price: number, from: Currency, to: Currency, fx: number | null) => {
  if (from === to || !fx) return price;
  return to === 'KRW' ? price * fx : price / fx;
};

export const fmtMoney = (v: number | null | undefined, currency: Currency) => {
  if (v == null || !Number.isFinite(v)) return '-';
  if (currency === 'KRW') return `₩${v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(2)}`;
  if (v >= 1000) return `$${Math.round(v).toLocaleString('en-US')}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(5)}`;
};

const signed = (v: number, d = 2) => `${v > 0 ? '+' : ''}${v.toFixed(d)}%`;
const fxOf = (tickers: Tickers) => Object.values(tickers).find(x => x?.usdKrw)?.usdKrw ?? null;

export const Card: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '18px', overflow: 'hidden', ...sx }}>{children}</Box>
);

/** 회색 바탕에 고른 것만 흰 버튼인 탭 */
export const Segmented = <T extends string>({ items, value, onChange, big }: { items: { k: T; label: string }[]; value: T; onChange: (v: T) => void; big?: boolean }) => (
  <Stack direction="row" gap={0.25} sx={{ p: big ? 0.5 : '3px', borderRadius: big ? '12px' : '9px', bgcolor: 'ui.pill.bg', flexShrink: 0 }}>
    {items.map(it => (
      <Box key={it.k} component="button" type="button" onClick={() => onChange(it.k)} aria-pressed={it.k === value} sx={{
        height: big ? 40 : 30, px: big ? 1.75 : 1.5, border: 0, borderRadius: big ? '9px' : '7px', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: big ? 14 : 13, fontWeight: big ? 800 : 700, whiteSpace: 'nowrap',
        bgcolor: it.k === value ? 'background.paper' : 'transparent', color: it.k === value ? 'text.primary' : 'text.secondary',
        boxShadow: it.k === value ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
      }}>{it.label}</Box>
    ))}
  </Stack>
);

const InfoDot: React.FC<{ title: string }> = ({ title }) => (
  <Tooltip title={title}>
    <Box component="span" sx={{
      width: 18, height: 18, borderRadius: '50%', border: '1.5px solid', borderColor: 'text.secondary', color: 'text.secondary',
      fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', flexShrink: 0,
    }}>i</Box>
  </Tooltip>
);

// ---------------------------------------------------------------------------
// 거래소별 가격 표: 머리글을 누르면 기준 거래소가 바뀐다
// ---------------------------------------------------------------------------
export const PriceTable: React.FC<{
  coins: string[]; base: ExchangeMeta; onBase: (id: TickerExchange) => void; mode: 'listing' | 'premium'; onMode: (m: 'listing' | 'premium') => void;
  currency: Currency; tickers: Tickers; images: Record<string, string | null>;
}> = ({ coins, base, onBase, mode, onMode, currency, tickers, images }) => {
  const { t } = useI18n();
  const fresh = useNewListings();
  const wallet = useWallet(coins);
  const notices = useNotices();
  const fx = fxOf(tickers);
  const now = Date.now();
  const priceIn = (ex: ExchangeMeta, coin: string, to: Currency) => {
    const tk = tickers[ex.id]?.data[coin];
    return tk ? convert(tk.price, ex.currency, to, fx) : null;
  };
  const cols = { xs: `110px repeat(${EXCHANGES.length}, minmax(96px, 1fr))`, md: `150px repeat(${EXCHANGES.length}, minmax(0, 1fr))` };
  const hl = 'ui.highlight.bg';
  // 입출금이 막힌 거래소는 값 아래에 빨갛게 (업비트는 공지 기준)
  const walletTag = (ex: ExchangeMeta, coin: string) => {
    const w = walletStatusOf(wallet, notices, ex.id, coin, now);
    if (!w || (w.deposit && w.withdraw)) return null;
    return t(!w.deposit && !w.withdraw ? 'wallet.both' : !w.deposit ? 'wallet.deposit' : 'wallet.withdraw');
  };

  return (
    <Card>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ px: 3, py: 2.25 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 800 }}>{t('mon.table')}</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          {mode === 'listing' ? t('mon.tableSubList', { unit: currency }) : t('mon.tableSubPrem', { ex: base.label })}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Segmented value={mode} onChange={onMode} items={[{ k: 'listing', label: t('mon.tabList') }, { k: 'premium', label: t('home.premium') }]} />
      </Stack>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: cols, minWidth: { xs: 110 + EXCHANGES.length * 96, md: 0 } }}>
          <Box sx={{ height: 52, borderTop: 1, borderBottom: 1, borderColor: 'divider' }} />
          {EXCHANGES.map(ex => {
            const sel = ex.id === base.id;
            return (
              <Tooltip key={ex.id} title={t('mon.setBase')}>
                <Box component="button" type="button" onClick={() => onBase(ex.id)} aria-pressed={sel} sx={{
                  height: 52, border: 0, borderTop: 1, borderBottom: 1, borderColor: 'divider', cursor: 'pointer', fontFamily: 'inherit',
                  bgcolor: sel ? hl : 'background.paper', color: sel ? 'primary.main' : 'text.secondary', fontSize: 14, fontWeight: sel ? 800 : 700,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                }}>
                  <Stack direction="row" alignItems="center" gap={0.75}><ExchangeBadge ex={ex} size={16} />{ex.label}</Stack>
                  <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>{ex.currency === 'KRW' ? 'KRW' : 'USDT'}</Box>
                </Box>
              </Tooltip>
            );
          })}
          {coins.map(coin => {
            const listed = EXCHANGES.map(ex => priceIn(ex, coin, 'USD')).filter((v): v is number => v != null);
            const hi = listed.length > 1 ? Math.max(...listed) : null;
            const lo = listed.length > 1 ? Math.min(...listed) : null;
            const basePrice = priceIn(base, coin, 'USD');
            return (
              <React.Fragment key={coin}>
                <Stack direction="row" alignItems="center" gap={1.125} sx={{ height: 60, pl: { xs: 1.5, md: 3 }, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}>
                  <CoinIcon symbol={coin} size={24} fallback={images[coin]} />
                  <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{coin}</Typography>
                  {fresh.get(coin) && <NewBadge info={fresh.get(coin)!} />}
                </Stack>
                {EXCHANGES.map(ex => {
                  const sel = ex.id === base.id;
                  const loaded = !!tickers[ex.id];
                  const usd = priceIn(ex, coin, 'USD');
                  const price = priceIn(ex, coin, currency);
                  const tag = walletTag(ex, coin);
                  let main: React.ReactNode = '…';
                  let sub: React.ReactNode = '';
                  let fg = 'text.primary';
                  let subFg: string = 'text.secondary';
                  if (loaded && price == null) { main = t('mon.notListed'); fg = 'text.disabled'; }
                  else if (loaded && mode === 'listing') {
                    main = fmtMoney(price, currency);
                    const h = usd != null && usd === hi ? 'hi' : usd != null && usd === lo ? 'lo' : null;
                    if (h) { sub = t(h === 'hi' ? 'mon.highest' : 'mon.lowest'); subFg = h === 'hi' ? UP : DOWN; }
                  } else if (loaded) {
                    // 프리미엄: 기준 거래소 대비 가격 차
                    const diff = basePrice && usd ? (usd / basePrice - 1) * 100 : null;
                    main = sel ? t('mon.base') : diff == null ? '-' : signed(diff);
                    fg = sel || diff == null ? 'text.secondary' : diff >= 0 ? UP : DOWN;
                    sub = fmtMoney(price, currency);
                  }
                  if (tag) { sub = tag; subFg = DOWN; }
                  return (
                    <Stack key={ex.id} alignItems="center" justifyContent="center" gap="3px" sx={{ height: 60, borderBottom: 1, borderColor: 'divider', bgcolor: sel ? hl : 'background.paper', px: 0.5 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: price == null ? 500 : sel ? 800 : 700, color: fg, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{main}</Typography>
                      {sub && <Typography sx={{ fontSize: 12, fontWeight: 600, color: subFg, whiteSpace: 'nowrap' }}>{sub}</Typography>}
                    </Stack>
                  );
                })}
              </React.Fragment>
            );
          })}
        </Box>
      </Box>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// 지수 줄: 누르면 가격 차트에 그 지수를 띄운다
// ---------------------------------------------------------------------------
const MACRO_OF: Record<string, MacroSymbol | undefined> = { SPX: 'SPX', NDX: 'NDX', DXY: 'DXY', 'BTC.D': 'BTC.D' };

export const MacroStrip: React.FC<{ active: string; onPick: (s: MacroSymbol) => void }> = ({ active, onPick }) => {
  const { t } = useI18n();
  // 반응형 테두리는 색을 함께 적어야 기본(글자색) 테두리로 덮이지 않는다
  const divider = useTheme().palette.divider;
  const { data } = useAsync(fetchOverview, [], 60_000);
  const items = data ?? [];
  return (
    <Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: `repeat(${items.length || 5}, minmax(0,1fr))` } }}>
        {items.map((it, i) => {
          const macro = MACRO_OF[it.id];
          const isMcap = it.id === 'TOTAL';
          const value = it.id === 'BTC.D' ? '' : isMcap ? `${(it.value / 1e12).toFixed(2)} T` : it.value.toLocaleString('en-US', { maximumFractionDigits: 3 });
          const pct = it.id === 'BTC.D' ? `${it.value.toFixed(2)}%` : it.changePct != null ? signed(it.changePct) : '-';
          const abs = it.change != null ? (isMcap ? `${(it.change / 1e9).toFixed(1)} B` : `${it.change > 0 ? '+' : ''}${it.change.toFixed(2)}`) : '';
          const col = it.id === 'BTC.D' || it.changePct == null ? 'text.primary' : it.changePct >= 0 ? UP : DOWN;
          return (
            <Tooltip key={it.id} title={macro ? t('mon.macroTip') : ''} disableHoverListener={!macro}>
              <Stack onClick={macro ? () => onPick(macro) : undefined} gap={0.75} sx={{
                px: 2.5, py: 1.75, minWidth: 0, borderRight: { md: i < items.length - 1 ? `1px solid ${divider}` : 0 }, borderBottom: { xs: `1px solid ${divider}`, md: 0 },
                bgcolor: macro && active === macro ? 'ui.highlight.bg' : 'transparent', cursor: macro ? 'pointer' : 'default',
                '&:hover': macro ? { bgcolor: 'ui.pill.bg' } : undefined,
              }}>
                <Stack direction="row" justifyContent="space-between" gap={1} sx={{ fontSize: 12.5 }}>
                  <Typography noWrap title={it.name} sx={{ fontSize: 12.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', minWidth: 0 }}>{it.name}</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.secondary', flexShrink: 0, whiteSpace: 'nowrap' }}>{value}</Typography>
                </Stack>
                <Stack direction="row" alignItems="baseline" gap={1} sx={{ whiteSpace: 'nowrap' }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, color: col, fontVariantNumeric: 'tabular-nums' }}>{pct}</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: col }}>{abs}</Typography>
                </Stack>
              </Stack>
            </Tooltip>
          );
        })}
      </Box>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// 코인 요약 카드
// ---------------------------------------------------------------------------
const BADGE_SKIP = new Set(['sum.change', 'sum.changeToday', 'sum.vsBtc', 'sum.kimp']);
const TONE: Record<Fact['tone'], string> = { up: UP, down: DOWN, warn: NEW_COLOR, info: '#3d6cf4', muted: '#7f8794' };

interface SummaryRow {
  coin: string; name: string; price: string; d0: number | null; vs: number | null; kimp: number | null; badges: Fact[];
}

const useSummaryRows = (coins: string[], base: ExchangeMeta, currency: Currency, tickers: Tickers): SummaryRow[] => {
  const { lang } = useI18n();
  const notices = useNotices();
  const wallet = useWallet(coins);
  const list = useAsync(loadCoinList, []).data ?? [];
  const fx = fxOf(tickers);
  return coins.map(coin => {
    const tk = tickers[base.id]?.data[coin];
    const ref = tickers[base.id]?.data[REF]?.change24h;
    const d0 = tk?.change24h ?? null;
    const up = tickers.upbit?.data[coin]?.price;
    const bn = tickers.binance?.data[coin]?.price;
    const item = list.find(c => c.symbol === coin);
    return {
      coin,
      name: (lang === 'ko' && item?.ko) || item?.en || coin,
      price: tk ? fmtMoney(convert(tk.price, base.currency, currency, fx), currency) : '-',
      d0,
      vs: coin !== REF && d0 != null && ref != null ? relVsRef(d0, ref) : null,
      kimp: up && bn && fx ? (up / fx / bn - 1) * 100 : null,
      badges: summarizeCoin({ coin, base: base.id, tickers, notices, wallet }).filter(f => !BADGE_SKIP.has(f.key)),
    };
  });
};

const SummaryCard: React.FC<{ row: SummaryRow; base: ExchangeMeta; compact?: boolean; active?: boolean; onChart?: () => void }> = ({ row, base, compact, active, onChart }) => {
  const { t } = useI18n();
  const colorOf = (v: number | null) => (v == null ? 'text.secondary' : v >= 0 ? UP : DOWN);
  return (
    <Stack gap={compact ? 1.25 : 1.5} sx={{
      bgcolor: 'background.paper', border: '1.5px solid', borderColor: active ? 'primary.main' : 'divider', borderRadius: compact ? '14px' : '16px',
      px: compact ? 2 : 2.25, py: compact ? 1.75 : 2,
    }}>
      <Stack direction="row" alignItems="center" gap={1.25}>
        <CoinIcon symbol={row.coin} size={compact ? 26 : 28} />
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 15.5, fontWeight: 800 }}>{row.coin}</Typography>
          {!compact && <Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary' }}>{row.name}</Typography>}
        </Stack>
        <Typography sx={{ fontSize: compact ? 15 : 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{row.price}</Typography>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 1, fontSize: 13.5 }}>
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>{base.id === 'upbit' ? t('mon.since0900', { ex: base.label }) : t('mon.change24h', { ex: base.label })}</Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 800, textAlign: 'right', color: colorOf(row.d0) }}>{row.d0 == null ? '-' : signed(row.d0)}</Typography>
        {row.coin !== REF && (
          <>
            <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>{t('mon.vsBtc')}</Typography>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, textAlign: 'right', color: colorOf(row.vs) }}>{row.vs == null ? '-' : signed(row.vs)}</Typography>
          </>
        )}
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>{t('mon.kimp')}</Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 800, textAlign: 'right' }}>{row.kimp == null ? '-' : signed(row.kimp)}</Typography>
      </Box>
      {(row.badges.length > 0 || onChart) && (
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
          {row.badges.map((f, i) => (
            <Box key={i} component="span" sx={{
              height: 24, px: 1.125, borderRadius: 99, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 800,
              color: TONE[f.tone], bgcolor: `${TONE[f.tone]}1f`,
            }}>{t(f.key as TKey, f.vars)}</Box>
          ))}
          <Box sx={{ flex: 1 }} />
          {onChart && (
            <Box component="button" type="button" onClick={onChart} sx={{
              height: 28, px: 1.25, border: 0, borderRadius: '7px', bgcolor: 'ui.pill.bg', color: active ? 'primary.main' : 'text.secondary',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', '&:hover': { color: 'primary.main' },
            }}>{active ? t('mon.chartShowing') : t('mon.chartShow')}</Box>
          )}
        </Stack>
      )}
    </Stack>
  );
};

export const SummaryCards: React.FC<{
  coins: string[]; base: ExchangeMeta; currency: Currency; tickers: Tickers; chartSymbol: string; onChart: (coin: string) => void;
  open: boolean; onToggle: () => void;
}> = ({ coins, base, currency, tickers, chartSymbol, onChart, open, onToggle }) => {
  const { t } = useI18n();
  const rows = useSummaryRows(coins, base, currency, tickers);
  return (
    <Stack gap={1.5}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ height: 32, px: 0.5 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap' }}>{t('sum.title')}</Typography>
        <InfoDot title={t('mon.sumHelp')} />
        <Tooltip title={open ? t('mon.sumHide') : t('mon.sumShow')}>
          <Box component="button" type="button" onClick={onToggle} aria-expanded={open} sx={{
            width: 30, height: 30, p: 0, border: 0, borderRadius: '50%', bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transform: open ? 'none' : 'rotate(180deg)', transition: 'transform .2s',
            '&:hover': { bgcolor: 'ui.pill.bg', color: 'text.primary' },
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><polyline points="3,9 7,5 11,9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Box>
        </Tooltip>
      </Stack>
      {open && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.5 }}>
          {rows.map(r => <SummaryCard key={r.coin} row={r} base={base} active={chartSymbol === r.coin} onChart={() => onChart(r.coin)} />)}
        </Box>
      )}
    </Stack>
  );
};

// ---------------------------------------------------------------------------
// CIM 카드: BTC 대비 / 절대 변동, 크게 보기(오른쪽에 코인 요약)
// ---------------------------------------------------------------------------
export const CimCard: React.FC<{
  exchange: ExchangeMeta; coins: string[]; tickers: Tickers; currency: Currency; resetKey: number;
}> = ({ exchange, coins, tickers, currency, resetKey }) => {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<'rel' | 'abs'>('rel');
  const [big, setBig] = useState(false);
  const rows = useSummaryRows(coins, exchange, currency, tickers);
  // 크게 보기: 화면 위에 띄우고 뒤쪽 스크롤을 막는다. Esc로 닫는다
  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBig(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [big]);
  const day = Highcharts.dateFormat(lang === 'ko' ? '%m월 %d일' : '%b %e', Math.floor(Date.now() / 86_400_000) * 86_400_000);
  const chartH = big ? Math.max(360, window.innerHeight - 200) : 480;

  return (
    <>
      {big && <Box onClick={() => setBig(false)} sx={{ position: 'fixed', inset: 0, zIndex: 1290, bgcolor: 'rgba(10,12,16,0.5)', backdropFilter: 'blur(3px)' }} />}
      <Box sx={{
        bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '18px', overflow: 'hidden', display: 'flex', flex: 1, minWidth: 0,
        ...(big ? { position: 'fixed', inset: { xs: 8, md: 40 }, zIndex: 1295, boxShadow: '0 30px 80px rgba(0,0,0,0.35)' } : {}),
      }}>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="flex-start" gap={1.5} sx={{ px: 3, pt: 2.5 }}>
            <Stack sx={{ flex: 1, gap: 0.75, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography onClick={() => setBig(true)} sx={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.3px', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}>Coin Impulse Monitor</Typography>
                <Box component="span" sx={{ height: 22, px: 0.875, borderRadius: '6px', bgcolor: 'ui.highlight.bg', color: 'ui.highlight.fg', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center' }}>CIM</Box>
                <InfoDot title={t('home.cimHelp')} />
              </Stack>
              <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
                {exchange.label} · {day} 09:00 ~ {t('mon.now')} · {mode === 'rel' ? t('home.cimVsBtc') : t('mon.cimAbsSub')}
              </Typography>
            </Stack>
            <Segmented value={mode} onChange={setMode} items={[{ k: 'rel', label: t('mon.cimRel') }, { k: 'abs', label: t('mon.cimAbs') }]} />
            <Tooltip title={big ? t('mon.close') : t('mon.enlarge')}>
              <Box component="button" type="button" onClick={() => setBig(b => !b)} aria-label={big ? t('mon.close') : t('mon.enlarge')} sx={{
                width: 36, height: 36, p: 0, border: 1, borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper', color: 'text.secondary',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
              }}>
                {big ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><polyline points="10,2 14,2 14,6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><polyline points="6,14 2,14 2,10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><line x1="14" y1="2" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><line x1="2" y1="14" x2="6.5" y2="9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                )}
              </Box>
            </Tooltip>
          </Stack>
          <Box sx={{ px: 1.5, pt: 1, pb: 1 }}>
            <Cim bare exchange={exchange} coins={coins} tickers={tickers[exchange.id]} currency={currency} resetKey={resetKey} mode={mode} height={chartH} />
          </Box>
        </Stack>
        {big && (
          <Stack gap={1.5} sx={{ width: 340, flexShrink: 0, borderLeft: 1, borderColor: 'divider', bgcolor: 'background.default', overflowY: 'auto', p: 2.5, display: { xs: 'none', md: 'flex' } }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{t('sum.title')}</Typography>
            {rows.map(r => <SummaryCard key={r.coin} row={r} base={exchange} compact />)}
          </Stack>
        )}
      </Box>
    </>
  );
};
