import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Chip, IconButton, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Cim from '../components/Cim';
import CoinSearch from '../components/CoinSearch';
import ExchangeBadge from '../components/ExchangeBadge';
import TradingViewWidget from '../components/TradingViewWidget';
import { useI18n } from '../i18n';
import { EXCHANGES, ExchangeMeta, exchangeMeta } from '../lib/exchanges';
import { storage } from '../lib/chartUtils';
import { useSelectedCoins } from '../lib/selectedCoins';
import { useAsync } from '../lib/useAsync';
import { useTickers } from '../lib/useTickers';
import { ExchangeTickers, TickerExchange, fetchCoinInfo, fetchOverview } from '../services/market';

type Currency = 'USD' | 'KRW';
type Mode = 'listing' | 'premium';

const ALL_EXCHANGES = EXCHANGES.map(e => e.id);
const UP = '#26a69a';
const DOWN = '#ef5350';

/** 거래소 통화 -> 표시 통화 변환 */
const convert = (price: number, from: Currency, to: Currency, fx: number | null) => {
  if (from === to || !fx) return price;
  return to === 'KRW' ? price * fx : price / fx;
};

const fmtMoney = (v: number | null | undefined, currency: Currency) => {
  if (v == null || !Number.isFinite(v)) return '-';
  if (currency === 'KRW') return `₩ ${Math.round(v).toLocaleString('en-US')}`;
  const digits = v >= 100 ? 0 : v >= 1 ? 3 : 6;
  return `$ ${v.toLocaleString('en-US', { maximumFractionDigits: digits })}`;
};

// ---------------------------------------------------------------------------
// 상단 지수 스트립
// ---------------------------------------------------------------------------
const OverviewStrip: React.FC = () => {
  const { data } = useAsync(fetchOverview, [], 60_000);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1, px: 1, py: 1 }}>
      {(data ?? []).map(it => {
        const up = (it.changePct ?? 0) >= 0;
        const isMcap = it.id === 'TOTAL';
        const value = it.id === 'BTC.D' ? `${it.value.toFixed(2)}%`
          : isMcap ? `${(it.value / 1e12).toFixed(2)} T` : it.value.toLocaleString('en-US', { maximumFractionDigits: 3 });
        return (
          <Box key={it.id} sx={{ minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 11 }}>
              <Typography noWrap sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{it.name}</Typography>
              <Typography sx={{ fontSize: 11, ml: 1 }}>{value}</Typography>
            </Stack>
            {it.changePct != null && (
              <Typography sx={{ color: up ? UP : DOWN, fontWeight: 700, fontSize: 17 }}>
                {up ? '▲' : '▼'} {Math.abs(it.changePct).toFixed(2)}%
                <Box component="span" sx={{ fontSize: 11, ml: 0.5, fontWeight: 400 }}>
                  {it.change != null ? (isMcap ? `${(it.change / 1e9).toFixed(1)} B` : it.change.toFixed(2)) : ''}
                </Box>
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// 마켓 차트 (TradingView)
// ---------------------------------------------------------------------------
const MarketChart: React.FC<{ coin: string; listed: TickerExchange[]; onClose: () => void }> = ({ coin, listed, onClose }) => {
  const [exId, setExId] = useState<TickerExchange>('binance');
  const options = listed.length ? listed : (['binance'] as TickerExchange[]);
  const ex = exchangeMeta(options.includes(exId) ? exId : options[0]);

  return (
    <Box>
      <Stack direction="row" gap={1} sx={{ mb: 1.5 }}>
        <Select size="small" value={ex.id} onChange={e => setExId(e.target.value as TickerExchange)}
          sx={{ minWidth: 220, bgcolor: 'ui.pill.bg', color: 'ui.pill.fg', fontSize: 13, fontWeight: 600, '& fieldset': { border: 0 }, '& .MuiSvgIcon-root': { color: 'ui.pill.fg' } }}>
          {options.map(id => {
            const m = exchangeMeta(id);
            return <MenuItem key={id} value={id}>{m.market(coin).replace(/[-_/]/g, '').toUpperCase()} - {m.label}</MenuItem>;
          })}
        </Select>
        <IconButton onClick={onClose} sx={{ bgcolor: 'ui.pill.bg', color: 'ui.pill.fg', borderRadius: 1, '&:hover': { bgcolor: 'ui.pill.hover' } }} size="small">✕</IconButton>
      </Stack>
      <Box sx={{ border: 1, borderColor: 'divider' }}>
        <OverviewStrip />
        <TradingViewWidget
          widget="advanced-chart"
          height={460}
          config={{ symbol: ex.tv(coin), interval: 'D', timezone: 'Asia/Seoul', style: '1', allow_symbol_change: true, hide_side_toolbar: true }}
        />
      </Box>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// 거래소 비교표 (Listing / Premium)
// ---------------------------------------------------------------------------
const CompareTable: React.FC<{
  coins: string[]; base: ExchangeMeta; mode: Mode; currency: Currency;
  tickers: Partial<Record<TickerExchange, ExchangeTickers>>; images: Record<string, string | null>;
}> = ({ coins, base, mode, currency, tickers, images }) => {
  const { t } = useI18n();
  const hl = 'ui.highlight.bg';
  const hlFg = 'ui.highlight.fg';
  const fx = Object.values(tickers).find(x => x?.usdKrw)?.usdKrw ?? null;
  const priceIn = (ex: ExchangeMeta, coin: string, to: Currency) => {
    const tk = tickers[ex.id]?.data[coin];
    return tk ? convert(tk.price, ex.currency, to, fx) : null;
  };
  // 기준 거래소를 맨 앞에
  const columns = [base, ...EXCHANGES.filter(e => e.id !== base.id)];

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 760, '& td, & th': { borderColor: 'divider' } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ bgcolor: hl, width: 130 }}>
              <Tooltip title={mode === 'listing' ? t('home.listingHelp') : t('home.premiumHelp', { ex: base.label })}>
                <Box component="span" sx={{ color: UP, cursor: 'help' }}>ⓘ</Box>
              </Tooltip>
            </TableCell>
            {columns.map(ex => (
              <TableCell key={ex.id} align="center" sx={{ bgcolor: ex.id === base.id ? hl : undefined, color: ex.id === base.id ? hlFg : 'text.secondary' }}>
                <ExchangeBadge ex={ex} />
                <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{ex.label}</Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {coins.map(coin => {
            const basePrice = priceIn(base, coin, 'USD');
            return (
              <TableRow key={coin}>
                <TableCell sx={{ bgcolor: hl, color: hlFg, fontWeight: 700 }}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    {images[coin] && <Box component="img" src={images[coin]!} alt="" sx={{ width: 18, height: 18 }} />}
                    {coin}
                  </Stack>
                </TableCell>
                {columns.map(ex => {
                  const loaded = !!tickers[ex.id];
                  const price = priceIn(ex, coin, currency);
                  const isBase = ex.id === base.id;
                  const cellSx = { bgcolor: isBase ? hl : undefined, color: isBase ? hlFg : undefined, fontWeight: 600, fontSize: 12 };
                  if (!loaded) return <TableCell key={ex.id} align="center" sx={cellSx}>…</TableCell>;
                  if (price == null) {
                    return <TableCell key={ex.id} align="center" sx={{ ...cellSx, color: 'text.disabled', fontSize: 18 }}>✕</TableCell>;
                  }
                  if (mode === 'listing' || isBase) {
                    return (
                      <TableCell key={ex.id} align="center" sx={cellSx}>
                        {mode === 'listing' && <Box sx={{ color: '#3ecf3e', fontSize: 18, lineHeight: 1 }}>✔</Box>}
                        {fmtMoney(price, currency)}
                      </TableCell>
                    );
                  }
                  const usd = priceIn(ex, coin, 'USD');
                  const diff = basePrice && usd ? (usd / basePrice - 1) * 100 : null;
                  return (
                    <TableCell key={ex.id} align="center" sx={cellSx}>
                      <Box sx={{ color: diff == null ? undefined : diff >= 0 ? UP : DOWN, textAlign: 'right' }}>
                        {diff == null ? '-' : `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`}
                      </Box>
                      {fmtMoney(price, currency)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------
const Home: React.FC = () => {
  const { t } = useI18n();
  const theme = useTheme();
  const { coins, add, remove, clear, active, setActive } = useSelectedCoins();
  const [baseId, setBaseId] = useState<TickerExchange>(() => storage.get('cimExchange', 'upbit'));
  const [mode, setMode] = useState<Mode>('listing');
  const [currency, setCurrency] = useState<Currency>(() => storage.get('cimCurrency', 'USD'));
  const [resetKey, setResetKey] = useState(0);
  // 처음에는 아이콘과 검색창만 보이고, 코인을 고르면 아래 모니터 영역이 펼쳐진다 (#monitor로 유지)
  const [opened, setOpened] = useState(() => window.location.hash === '#monitor');
  const chartRef = useRef<HTMLDivElement>(null);
  const base = exchangeMeta(baseId);

  useEffect(() => storage.set('cimExchange', baseId), [baseId]);
  useEffect(() => storage.set('cimCurrency', currency), [currency]);

  const tickers = useTickers(ALL_EXCHANGES, coins, 3000);
  const info = useAsync(() => (coins.length ? fetchCoinInfo(coins) : Promise.resolve([])), [coins.join(',')], 300_000);
  const images = useMemo(() => Object.fromEntries((info.data ?? []).map(c => [c.symbol, c.image])), [info.data]);

  const chartCoin = coins.includes(active) ? active : coins[0];
  const listedOn = (coin: string) => EXCHANGES.filter(e => tickers[e.id]?.data[coin]).map(e => e.id);

  // 펼친 직후에는 차트·지수 영역이 그려지며 높이가 바뀌므로, 잠시 기다린 뒤 위치를 계산해 스크롤한다
  const [scrollTick, setScrollTick] = useState(0);
  useEffect(() => {
    if (!scrollTick) return;
    const id = setTimeout(() => {
      const el = chartRef.current;
      if (!el) return;
      // 고정 헤더(메뉴 + 티커 바) 높이만큼 띄운다.
      // 부드러운 스크롤은 탭이 화면에 안 보일 때 등 실행되지 않는 경우가 있어 즉시 이동한다
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110);
    }, 150);
    return () => clearTimeout(id);
  }, [scrollTick]);

  const open = () => {
    setOpened(true);
    window.history.replaceState(null, '', '#monitor');
    setScrollTick(n => n + 1);
  };

  const pick = (coin: string) => {
    add(coin);
    open();
  };

  const clearAll = () => {
    clear();
    setOpened(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const pill = (active: boolean) => ({
    borderRadius: 99, px: 1.8, py: 0.4, fontSize: 13, fontWeight: 700, minWidth: 0,
    bgcolor: active ? 'primary.main' : 'ui.pill.bg', color: active ? '#fff' : 'ui.pill.fg', '&:hover': { bgcolor: active ? 'primary.dark' : 'ui.pill.hover' },
  });

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* 검색 히어로 */}
      <Stack alignItems="center" justifyContent="center"
        sx={{ py: { xs: 5, md: 10 }, minHeight: opened && coins.length ? undefined : 'calc(100vh - 260px)' }}>
        <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, mb: 6 }}>◆</Box>
        <Box sx={{ width: '100%', maxWidth: 560 }}>
          <CoinSearch onSelect={pick} size="large" />
        </Box>
        <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={1} sx={{ mt: 2 }}>
          {coins.length > 0 && <Chip label={t('home.clearAll')} onClick={clearAll} sx={{ bgcolor: 'ui.pill.bg', color: DOWN, fontWeight: 700 }} />}
          {coins.map(c => (
            <Chip key={c} label={c} onClick={() => { setActive(c); open(); }}
              onDelete={() => remove(c)}
              sx={{ bgcolor: 'ui.highlight.bg', color: 'ui.highlight.fg', fontWeight: 700, '& .MuiChip-deleteIcon': { color: 'text.disabled' } }} />
          ))}
          {coins.length > 0 && (
            <Button size="small" onClick={() => { setResetKey(k => k + 1); open(); }} sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {t('home.reload')} ⟳
            </Button>
          )}
        </Stack>
      </Stack>

      {opened && coins.length > 0 && chartCoin && (
        <>
          <Box ref={chartRef} sx={{ scrollMarginTop: 120 }}>
            <MarketChart coin={chartCoin} listed={listedOn(chartCoin)} onClose={() => remove(chartCoin)} />
          </Box>

          {/* 거래소 비교 */}
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={2} sx={{ mt: 8, mb: 3 }}>
            <Stack direction="row" gap={1} alignItems="center">
              <Select size="small" value={baseId} onChange={e => setBaseId(e.target.value as TickerExchange)}
                renderValue={v => (
                  <Stack direction="row" alignItems="center" gap={1}><ExchangeBadge ex={exchangeMeta(v)} size={18} />{exchangeMeta(v).label}</Stack>
                )}
                sx={{ minWidth: 130, bgcolor: 'ui.pill.bg', color: 'ui.pill.fg', fontSize: 14, fontWeight: 600, '& fieldset': { border: 0 }, '& .MuiSvgIcon-root': { color: 'ui.pill.fg' } }}>
                {EXCHANGES.map(e => (
                  <MenuItem key={e.id} value={e.id}><Stack direction="row" alignItems="center" gap={1}><ExchangeBadge ex={e} size={18} />{e.label}</Stack></MenuItem>
                ))}
              </Select>
              <Button sx={pill(mode === 'listing')} onClick={() => setMode('listing')}>{t('home.listing')}</Button>
              <Button sx={pill(mode === 'premium')} onClick={() => setMode('premium')}>{t('home.premium')}</Button>
            </Stack>
            <Box sx={{ flexGrow: 1, maxWidth: { md: 560 }, mx: { md: 'auto' } }}>
              <CoinSearch onSelect={add} />
            </Box>
            <Tooltip title={t('home.currencyToggle')}>
              <Button size="small" onClick={() => setCurrency(c => (c === 'USD' ? 'KRW' : 'USD'))}
                sx={{ bgcolor: 'ui.highlight.bg', color: 'ui.highlight.fg', fontSize: 11, fontWeight: 700, minWidth: 0, px: 1, '&:hover': { bgcolor: 'ui.pill.hover' } }}>
                {currency} ⇄
              </Button>
            </Tooltip>
          </Stack>
          <CompareTable coins={coins} base={base} mode={mode} currency={currency} tickers={tickers} images={images} />

          {/* CIM */}
          <Box sx={{ mt: 10, borderTop: 2, borderColor: '#3d6cf4', pt: 2 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: theme.palette.text.primary }}>Coin Impulse Monitor (CIM)</Typography>
              <Tooltip title={t('home.cimHelp')}><Box component="span" sx={{ color: 'text.secondary', cursor: 'help' }}>ⓘ</Box></Tooltip>
            </Stack>
            <Cim exchange={base} coins={coins} tickers={tickers[base.id]} currency={currency} resetKey={resetKey} />
          </Box>
        </>
      )}
    </Box>
  );
};

export default Home;
