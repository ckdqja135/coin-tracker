import React, { useMemo, useRef, useState } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import CoinIcon from './CoinIcon';
import { loadCoinList } from './CoinSearch';
import { useI18n } from '../i18n';
import { useNotices } from '../lib/newListings';
import { Mover, signed, summarizeMarket } from '../lib/summary';
import { useAsync } from '../lib/useAsync';
import { DOWN, UP } from '../lib/vsRef';
import { CoinListItem, ExchangeTickers, fetchTickers } from '../services/market';

/** 첫 화면 공통 폭 (검색창 760, 오늘의 업비트 1040) */
const SEARCH_W = 760;
const SECTION_W = 1040;
const POPULAR = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE'];
const WARN = '#c77800';
const UP_BG = 'rgba(38,166,154,0.12)';
const DOWN_BG = 'rgba(239,83,80,0.10)';
/** 유의 지정·거래지원 종료 카드에 보여 줄 공지 기간 */
const RISK_WINDOW = 7 * 86_400_000;

// 검색 드롭다운의 가격과 오늘의 업비트가 같은 업비트 전체 시세를 쓰므로 잠시 공유한다
const UPBIT_TTL = 30_000;
let upbitCache: { at: number; p: Promise<ExchangeTickers> } | null = null;
const loadUpbit = (force = false) => {
  if (force || !upbitCache || Date.now() - upbitCache.at > UPBIT_TTL) {
    const p = fetchTickers('upbit', []).catch(e => { upbitCache = null; throw e; });
    upbitCache = { at: Date.now(), p };
  }
  return upbitCache.p;
};

const krw = (p: number) => (p >= 100 ? Math.round(p).toLocaleString('ko-KR') : p >= 1 ? p.toFixed(2) : p.toPrecision(3));

// ---------------------------------------------------------------------------
// 큰 검색창: 포커스하면 인기 코인, 입력하면 검색 결과를 가격·등락률과 함께 보여 준다
// ---------------------------------------------------------------------------
export const HeroSearch: React.FC<{
  onPick: (symbol: string) => void;
  /** 모니터 위쪽용 작은 검색창: 왼쪽 돋보기, 오른쪽 선택 개수, 이미 고른 코인은 "추가됨" */
  compact?: boolean; selected?: string[]; countLabel?: string;
}> = ({ onPick, compact, selected = [], countLabel }) => {
  const { t, lang } = useI18n();
  const coins = useAsync(loadCoinList, []).data;
  const upbit = useAsync(() => loadUpbit(), [], UPBIT_TTL).data;
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<CoinListItem[]>(() => {
    const list = coins ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return POPULAR.map(s => list.find(c => c.symbol === s) ?? { symbol: s, en: s, ko: null });
    // 정확히 일치 > 심볼 접두어(짧은 순) > 이름 포함
    const exact = list.filter(c => c.symbol.toLowerCase() === query);
    const starts = list.filter(c => c.symbol.toLowerCase() !== query && c.symbol.toLowerCase().startsWith(query))
      .sort((a, b) => a.symbol.length - b.symbol.length);
    const rest = list.filter(c => !c.symbol.toLowerCase().startsWith(query)
      && (c.en.toLowerCase().includes(query) || (c.ko ?? '').includes(query)));
    return [...exact, ...starts, ...rest].slice(0, 6);
  }, [q, coins]);

  const pick = (symbol: string) => {
    onPick(symbol);
    setQ('');
    setFocus(false);
    inputRef.current?.blur();
  };
  const onKey = (e: React.KeyboardEvent) => {
    // 한글 입력 중(조합 중) Enter는 글자 확정이므로 선택으로 처리하지 않는다
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[active]) pick(results[active].symbol);
    if (e.key === 'Escape') { setQ(''); inputRef.current?.blur(); }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', maxWidth: compact ? 'none' : SEARCH_W, mt: compact ? 0 : 4 }}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={compact ? {
        height: 52, pl: 2.25, pr: 1.5, bgcolor: 'background.paper', borderRadius: '14px', border: 2, borderColor: focus ? 'primary.main' : 'divider',
        boxShadow: focus ? (th: any) => `0 0 0 4px ${th.palette.ui.highlight.bg}` : 'none', transition: 'all .15s',
      } : {
        height: { xs: 56, md: 64 }, pl: 3, pr: 2.5, bgcolor: 'background.paper', borderRadius: 99,
        border: 2, borderColor: focus ? 'primary.main' : 'divider', boxShadow: '0 4px 18px rgba(0,0,0,0.06)', transition: 'border-color .15s',
      }}>
        {compact && (
          <Box component="svg" viewBox="0 0 20 20" aria-hidden sx={{ width: 18, height: 18, flexShrink: 0, color: 'text.secondary' }}>
            <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </Box>
        )}
        <Box component="input" ref={inputRef} value={q} placeholder={compact ? t('search.coins') : t('hero.placeholder')} aria-label={t('hero.placeholder')}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setQ(e.target.value); setActive(0); }}
          onFocus={() => { setFocus(true); setActive(0); }} onBlur={() => setFocus(false)} onKeyDown={onKey}
          sx={{
            flex: 1, minWidth: 0, border: 0, outline: 0, bgcolor: 'transparent', color: 'text.primary', fontFamily: 'inherit',
            fontSize: compact ? 16 : { xs: 16, md: 17 }, fontWeight: 500, '&::placeholder': { color: 'text.secondary', opacity: 1 },
          }} />
        {compact ? (
          <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap' }}>{countLabel}</Typography>
        ) : (
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: 12, fontWeight: 700, color: 'text.secondary', border: 1, borderColor: 'divider', borderRadius: 1.5, px: 0.9, py: 0.25 }}>
            Enter
          </Box>
        )}
        <Box component="svg" viewBox="0 0 20 20" aria-hidden onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); if (q.trim() && results[0]) pick(results[0].symbol); }}
          sx={{ width: 22, height: 22, cursor: 'pointer', color: 'primary.main', flexShrink: 0, display: compact ? 'none' : 'block' }}>
          <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </Box>
      </Stack>

      {focus && (
        <Box role="listbox" sx={{
          position: 'absolute', top: compact ? 60 : { xs: 64, md: 72 }, left: 0, right: 0, zIndex: 20, bgcolor: 'background.paper',
          border: 1, borderColor: 'divider', borderRadius: compact ? '14px' : '20px', boxShadow: '0 16px 40px rgba(0,0,0,0.14)', p: 1.25,
        }}>
          <Typography sx={{ px: 1.75, pt: 0.75, pb: 1, fontSize: 12.5, fontWeight: 700, color: 'text.secondary' }}>
            {q.trim() ? t('hero.results', { n: String(results.length) }) : t('hero.popular')}
          </Typography>
          {results.map((c, i) => {
            const tk = upbit?.data[c.symbol];
            const chg = tk?.change24h;
            return (
              <Box key={c.symbol} role="option" aria-selected={i === active}
                onMouseDown={e => { e.preventDefault(); pick(c.symbol); }} onMouseEnter={() => setActive(i)}
                sx={{
                  display: 'grid', gridTemplateColumns: '28px 1fr auto 76px', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.25,
                  borderRadius: '12px', cursor: 'pointer', bgcolor: i === active ? 'ui.pill.bg' : 'transparent',
                }}>
                <CoinIcon symbol={c.symbol} size={26} />
                <Stack direction="row" alignItems="baseline" gap={1} sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{c.symbol}</Typography>
                  <Typography noWrap sx={{ fontSize: 13.5, color: 'text.secondary' }}>{lang === 'ko' && c.ko ? c.ko : c.en}</Typography>
                </Stack>
                <Typography sx={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{tk ? `₩${krw(tk.price)}` : '-'}</Typography>
                {selected.includes(c.symbol) ? (
                  <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'primary.main' }}>{t('hero.added')}</Typography>
                ) : (
                  <Typography sx={{ fontSize: 14, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: chg == null ? 'text.secondary' : chg >= 0 ? UP : DOWN }}>
                    {chg == null ? '-' : signed(chg, 1)}
                  </Typography>
                )}
              </Box>
            );
          })}
          {q.trim() && results.length === 0 && (
            <Typography sx={{ p: 1.75, fontSize: 14, color: 'text.secondary' }}>{t('hero.noResults')}</Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// 오늘의 업비트: BTC 등락, 상승·하락 종목 수, 상승·하락 상위, 유의 지정·거래지원 종료
// ---------------------------------------------------------------------------
const Card: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '16px', ...sx }}>{children}</Box>
);

const Stat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <Card sx={{ px: 2.75, py: 2.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
    <Typography sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
  </Card>
);

const Movers: React.FC<{ title: string; list: Mover[]; up: boolean; onPick: (s: string) => void }> = ({ title, list, up, onPick }) => (
  <Card sx={{ px: 2.75, py: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
    <Typography sx={{ fontSize: 15, fontWeight: 800, mb: 0.75 }}>{title}</Typography>
    {list.map((m, i) => (
      <Box key={m.coin} component="button" type="button" onClick={() => onPick(m.coin)} sx={{
        display: 'grid', gridTemplateColumns: '18px 24px 1fr auto', alignItems: 'center', gap: 1.25, height: 40, px: 0.5, mx: -0.5,
        border: 0, bgcolor: 'transparent', borderRadius: 1.5, cursor: 'pointer', fontFamily: 'inherit', color: 'text.primary', textAlign: 'left',
        '&:hover': { bgcolor: 'ui.pill.bg' },
      }}>
        <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>{i + 1}</Typography>
        <CoinIcon symbol={m.coin} size={24} />
        <Typography component="span" sx={{ fontSize: 15, fontWeight: 700 }}>{m.coin}</Typography>
        <Box component="span" sx={{
          height: 28, minWidth: 72, px: 1.25, boxSizing: 'border-box', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          bgcolor: up ? UP_BG : DOWN_BG, color: up ? UP : DOWN, fontSize: 14.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
        }}>
          {signed(m.change, 1)}
        </Box>
      </Box>
    ))}
  </Card>
);

const NoticeCoins: React.FC<{ title: string; color: string; coins: string[]; sub: string; onPick: (s: string) => void; empty: string }> = ({ title, color, coins, sub, onPick, empty }) => (
  <Card sx={{ px: 2.75, py: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
    <Stack direction="row" alignItems="center" gap={1}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
      <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color }}>{coins.length}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{sub}</Typography>
    </Stack>
    {coins.length ? (
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {coins.map(c => (
          <Box key={c} component="button" type="button" onClick={() => onPick(c)} sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, height: 32, pl: 0.875, pr: 1.375, borderRadius: 2, border: 1, borderColor: 'divider',
            bgcolor: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'text.primary', fontSize: 14, fontWeight: 700,
            '&:hover': { borderColor: color },
          }}>
            <CoinIcon symbol={c} size={18} />
            {c}
          </Box>
        ))}
      </Stack>
    ) : (
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{empty}</Typography>
    )}
  </Card>
);

export const TodayUpbit: React.FC<{ onPick: (coin: string) => void }> = ({ onPick }) => {
  const { t } = useI18n();
  const notices = useNotices();
  const [reloadKey, setReloadKey] = useState(0);
  const { data } = useAsync(() => loadUpbit(reloadKey > 0), [reloadKey], UPBIT_TTL);
  const sum = useMemo(() => summarizeMarket(data, notices, Date.now(), 3, RISK_WINDOW), [data, notices]);
  if (!data) return null;
  const time = new Date(data.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });
  return (
    <Stack gap={1.75} sx={{ width: '100%', maxWidth: SECTION_W, mt: { xs: 5, md: 7 } }}>
      <Stack direction="row" alignItems="center" gap={1.25}>
        <Typography sx={{ fontSize: 19, fontWeight: 800 }}>{t('today.title')}</Typography>
        <Tooltip title={t('today.help')}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', cursor: 'help' }}>{t('today.sub', { time })}</Typography>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Box component="button" type="button" onClick={() => setReloadKey(k => k + 1)} sx={{
          height: 32, px: 1.5, border: 0, bgcolor: 'transparent', color: 'text.secondary', borderRadius: 2, fontSize: 13.5, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', '&:hover': { bgcolor: 'ui.pill.bg', color: 'text.primary' },
        }}>
          ↻ {t('home.reload')}
        </Box>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0,1fr))' }, gap: 1.75 }}>
        <Stat label={t('today.btc')} value={sum.btc == null ? '-' : signed(sum.btc)} color={sum.btc == null ? undefined : sum.btc >= 0 ? UP : DOWN} />
        <Stat label={t('today.up')} value={String(sum.up)} color={UP} />
        <Stat label={t('today.down')} value={String(sum.down)} color={DOWN} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' }, gap: 1.75 }}>
        <Movers title={t('mkt.gainers')} list={sum.gainers} up onPick={onPick} />
        <Movers title={t('mkt.losers')} list={sum.losers} up={false} onPick={onPick} />
        <NoticeCoins title={t('mkt.warnings')} color={WARN} coins={sum.warnings} sub={t('today.last7d')} onPick={onPick} empty={t('today.none')} />
        <NoticeCoins title={t('mkt.delistings')} color={DOWN} coins={sum.delistings} sub={t('today.last7d')} onPick={onPick} empty={t('today.none')} />
      </Box>
    </Stack>
  );
};
