import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack } from '@mui/material';
import { useLocation } from 'react-router-dom';
import CoinIcon from '../components/CoinIcon';
import { LogoMark, Wordmark } from '../components/Logo';
import { HeroSearch, TodayUpbit } from '../components/HomeMain';
import { CimCard, Currency, MacroStrip, PriceTable, Segmented, SummaryCards } from '../components/Monitor';
import PriceChart, { MACRO_SYMBOLS, MacroSymbol } from '../components/PriceChart';
import { useI18n } from '../i18n';
import { exchangeMeta } from '../lib/exchanges';
import { storage } from '../lib/chartUtils';
import { MAX_COINS, PINNED_COIN, useSelectedCoins } from '../lib/selectedCoins';
import { useAsync } from '../lib/useAsync';
import { useSharedTickers } from '../lib/sharedTickers';
import { DOWN } from '../lib/vsRef';
import { TickerExchange, fetchCoinInfo } from '../services/market';

type Mode = 'listing' | 'premium';

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------
const Home: React.FC = () => {
  const { t } = useI18n();
  const { coins, add, remove, clear, active, setActive } = useSelectedCoins();
  const [baseId, setBaseId] = useState<TickerExchange>(() => storage.get('cimExchange', 'upbit'));
  const [mode, setMode] = useState<Mode>('listing');
  const [currency, setCurrency] = useState<Currency>(() => storage.get('cimCurrency', 'USD'));
  const [resetKey, setResetKey] = useState(0);
  // 처음에는 아이콘과 검색창만 보이고, 코인을 고르면 아래 모니터 영역이 펼쳐진다 (#monitor로 유지)
  const [opened, setOpened] = useState(() => window.location.hash === '#monitor');
  // 홈에서 로고를 다시 누르면(라우터 이동만 일어나고 화면은 그대로라) 첫 화면으로 돌아가 맨 위로 올린다.
  // #monitor는 라우터를 거치지 않고 붙이므로, 라우터 이동이 일어났는데 주소에 #monitor가 없으면 첫 화면이다
  const location = useLocation();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (location.hash !== '#monitor') {
      setOpened(false);
      window.scrollTo(0, 0);
    }
  }, [location.key, location.hash]);
  const base = exchangeMeta(baseId);

  useEffect(() => storage.set('cimExchange', baseId), [baseId]);
  useEffect(() => storage.set('cimCurrency', currency), [currency]);

  // 선택 코인(+BTC) 시세는 Tools 패널과 함께 쓰는 공유 시세에서 받는다
  const tickers = useSharedTickers();
  const info = useAsync(() => (coins.length ? fetchCoinInfo(coins) : Promise.resolve([])), [coins.join(',')], 300_000);
  const images = useMemo(() => Object.fromEntries((info.data ?? []).map(c => [c.symbol, c.image])), [info.data]);

  const chartCoin = coins.includes(active) ? active : coins[0];
  // 가격 차트에 띄운 코인/지수, 차트·코인 요약 접힘 상태 (접힘은 기억한다)
  const [chartSymbol, setChartSymbol] = useState<string>(() => chartCoin ?? 'BTC');
  const [chartOpen, setChartOpen] = useState<boolean>(() => storage.get('marketChartOpen', true));
  const [sumOpen, setSumOpen] = useState<boolean>(() => storage.get('coinSummaryOpen', true));
  useEffect(() => storage.set('marketChartOpen', chartOpen), [chartOpen]);
  useEffect(() => storage.set('coinSummaryOpen', sumOpen), [sumOpen]);
  // 선택 코인 칩을 누르면 그 코인을 가격 차트에 띄운다. 차트의 코인이 빠지면 첫 코인으로
  useEffect(() => { if (chartCoin && coins.includes(active)) setChartSymbol(active); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!MACRO_SYMBOLS.includes(chartSymbol as MacroSymbol) && !coins.includes(chartSymbol) && coins[0]) setChartSymbol(coins[0]);
  }, [coins.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새로고침 시 브라우저가 이전 스크롤 위치를 되살리지 않게, 홈에서는 스크롤을 직접 관리한다
  useEffect(() => {
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = prev; };
  }, []);

  const open = () => {
    setOpened(true);
    window.history.replaceState(null, '', '#monitor');
    // 모니터는 첫 화면을 대신하므로 맨 위(차트 영역)부터 보여 준다
    window.scrollTo(0, 0);
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

  // 선택 코인 칩 (첫 화면 검색창 아래, 모니터에서는 거래소 비교 위)
  // 선택 코인 칩 (첫 화면 검색창 아래, 모니터에서는 거래소 비교 위). BTC는 고정이라 지울 수 없다
  const textBtn = (color: string) => ({
    height: 34, px: 0.75, border: 0, bgcolor: 'transparent', color, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    '&:hover': { color: 'text.primary' },
  });
  const chips = (
    <Stack direction="row" flexWrap="wrap" justifyContent="center" alignItems="center" gap={1} sx={{ minHeight: 36 }}>
      {coins.map(c => (
        <Stack key={c} direction="row" alignItems="center" gap={0.5} sx={{ height: 34, pl: 1, pr: c === PINNED_COIN ? 1.25 : 0.75, borderRadius: 99, bgcolor: 'ui.highlight.bg' }}>
          <Stack component="button" type="button" direction="row" alignItems="center" gap={0.875} onClick={() => { setActive(c); open(); }}
            sx={{ border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
            <CoinIcon symbol={c} size={20} fallback={images[c]} />
            <Box component="span" sx={{ fontSize: 14, fontWeight: 700, color: 'ui.highlight.fg' }}>{c}</Box>
          </Stack>
          {c !== PINNED_COIN && (
            <Box component="button" type="button" onClick={() => remove(c)} aria-label={`${c} ${t('home.remove')}`} title={t('home.remove')}
              sx={{ width: 20, height: 20, p: 0, border: 0, borderRadius: '50%', bgcolor: 'transparent', color: 'ui.highlight.fg', fontSize: 10, cursor: 'pointer', opacity: 0.7, '&:hover': { opacity: 1 } }}>
              ✕
            </Box>
          )}
        </Stack>
      ))}
      {coins.length > 1 && (
        <>
          <Box sx={{ width: '1px', height: 14, bgcolor: 'divider', mx: 0.5 }} />
          <Box component="button" type="button" onClick={clearAll} sx={textBtn(DOWN)}>{t('home.clearAll')}</Box>
        </>
      )}
      {coins.length > 0 && (
        <Box component="button" type="button" onClick={() => { setResetKey(k => k + 1); open(); }} sx={textBtn('text.secondary')}>
          {t('home.reload')} ⟳
        </Box>
      )}
    </Stack>
  );

  // 모니터를 열면 첫 화면(로고·검색·시장 요약)은 그리지 않고 차트 영역이 맨 위에 온다. 로고를 누르면 첫 화면으로 돌아간다
  const monitor = opened && coins.length > 0 && !!chartCoin;

  return (
    <Box sx={{ maxWidth: monitor ? 1400 : 1040, mx: 'auto' }}>
      {/* 첫 화면: 로고 · 큰 검색창 · 선택 코인 · 오늘의 업비트 */}
      {!monitor && (
        <Stack alignItems="center" sx={{ pt: { xs: 5, md: 9 }, pb: { xs: 6, md: 12 }, px: { xs: 0, md: 0 } }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{ '& svg': { width: { xs: 36, md: 44 }, height: { xs: 36, md: 44 } } }}><LogoMark size={44} /></Box>
            <Box component="h1" sx={{ m: 0, color: 'text.primary', letterSpacing: '-1.2px' }}><Wordmark fontSize={{ xs: 30, md: 38 }} /></Box>
          </Stack>
          <HeroSearch onPick={pick} />
          <Box sx={{ mt: 2 }}>{chips}</Box>
          <TodayUpbit onPick={pick} />
        </Stack>
      )}

      {monitor && (
        <Stack gap={3} sx={{ pt: 1, pb: 6 }}>
          {/* 검색 · 표시 통화 · 선택 코인 */}
          <Stack gap={1.75}>
            <Stack direction="row" alignItems="center" gap={1.5}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <HeroSearch compact onPick={add} selected={coins} countLabel={`${coins.length} / ${MAX_COINS}`} />
              </Box>
              <Segmented big value={currency} onChange={setCurrency} items={[{ k: 'USD', label: 'USD' }, { k: 'KRW', label: 'KRW' }]} />
            </Stack>
            <Box sx={{ '& > div': { justifyContent: 'flex-start' } }}>{chips}</Box>
          </Stack>

          <PriceTable coins={coins} base={base} onBase={setBaseId} mode={mode} onMode={setMode} currency={currency} tickers={tickers} images={images} />

          <MacroStrip active={chartSymbol} onPick={s => { setChartSymbol(s); setChartOpen(true); }} />

          {/* CIM과 가격 차트 (넓은 화면에서 나란히, 차트를 접으면 CIM이 넓어진다) */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: chartOpen ? 'repeat(2, minmax(0,1fr))' : 'minmax(0,1fr) auto' }, gap: 2.5, alignItems: 'stretch' }}>
            <Box sx={{ minWidth: 0, display: 'flex' }}>
              <CimCard exchange={base} coins={coins} tickers={tickers} currency={currency} resetKey={resetKey} />
            </Box>
            <PriceChart symbol={chartSymbol} onSymbol={setChartSymbol} open={chartOpen} onToggle={() => setChartOpen(o => !o)}
              coins={coins.map(c => ({ symbol: c, onBinance: !tickers.binance || !!tickers.binance.data[c] }))} />
          </Box>

          <SummaryCards coins={coins} base={base} currency={currency} tickers={tickers} chartSymbol={chartSymbol}
            onChart={c => { setChartSymbol(c); setChartOpen(true); }} open={sumOpen} onToggle={() => setSumOpen(o => !o)} />
        </Stack>
      )}
    </Box>
  );
};

export default Home;
