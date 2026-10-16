import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TKey, useI18n } from '../i18n';
import { PINNED_COIN, useSelectedCoins } from '../lib/selectedCoins';
import { useAsync } from '../lib/useAsync';
import { Notice, NoticeExchange, NoticeKind, fetchNotices } from '../services/market';

type Filter = 'all' | 'listing' | 'risk';
const FILTERS: Filter[] = ['all', 'listing', 'risk'];
const DAY = 86_400_000;
const KST = 9 * 3600_000;

const match = (n: Notice, f: Filter) => f === 'all' || (f === 'listing' ? n.kind === 'listing' : n.kind === 'delisting' || n.kind === 'warning');
/** 한국시간 날짜 키 (YYYY-MM-DD) */
const dayKey = (t: number) => new Date(t + KST).toISOString().slice(0, 10);
const hhmm = (t: number) => new Date(t + KST).toISOString().slice(11, 16);

/** 상장 · 거래지원 종료 · 유의 색 */
const usePalette = () => {
  const dark = useTheme().palette.mode === 'dark';
  return {
    kind: (dark
      ? { listing: '#25a684', delisting: '#e0575d', warning: '#d9961e' }
      : { listing: '#1f9a7a', delisting: '#d63c42', warning: '#d68a00' }) as Record<Exclude<NoticeKind, 'other'>, string>,
    ex: (dark ? { upbit: '#a9c0ff', bithumb: '#ffa766' } : { upbit: '#2a4aa8', bithumb: '#c4560b' }) as Record<NoticeExchange, string>,
  };
};

/** 회색 바탕에 고른 것만 흰 버튼인 탭 */
const segBtn = (active: boolean) => ({
  display: 'flex', alignItems: 'center', gap: 0.875, height: 34, px: 1.75, border: 0, borderRadius: '9px', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
  bgcolor: active ? 'background.paper' : 'transparent', color: active ? 'text.primary' : 'text.secondary',
  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
});

/** 업비트·빗썸 공지 모음: 종류별 요약 카드 + 날짜별 타임라인. 코인을 누르면 홈 모니터에 넣고 뺀다 */
const Notices: React.FC = () => {
  const { t, lang } = useI18n();
  const pal = usePalette();
  const { coins: watched, add, remove } = useSelectedCoins();
  const [filter, setFilter] = useState<Filter>('all');
  const [exchange, setExchange] = useState<NoticeExchange | 'all'>('all');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const { data, error, loading } = useAsync(fetchNotices, [], 60_000);
  const now = Date.now();
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY);

  const q = query.trim().toLowerCase();
  // 거래소·검색어로 거른 목록 (요약 카드 숫자는 이것 기준)
  const base = useMemo(() => (data ?? []).filter(n => (exchange === 'all' || n.exchange === exchange)
    && (!q || n.title.toLowerCase().includes(q) || n.coins.some(c => c.toLowerCase().includes(q)))), [data, exchange, q]);
  const list = base.filter(n => match(n, filter));

  // 날짜별로 묶는다 (최신순)
  const groups = useMemo(() => {
    const out: { key: string; items: Notice[] }[] = [];
    list.forEach(n => {
      const key = dayKey(n.time);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(n); else out.push({ key, items: [n] });
    });
    return out;
  }, [list]);

  const dateLabel = (key: string) => {
    const d = new Date(`${key}T00:00:00+09:00`);
    return d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };
  // 코인 칩: 홈 모니터에 넣고 뺀다 (BTC는 항상 고정)
  const toggleCoin = (c: string) => {
    if (watched.includes(c)) {
      if (c === PINNED_COIN) { showToast(t('notices.pinned', { c })); return; }
      remove(c);
      showToast(t('notices.removed', { c }));
    } else {
      add(c);
      showToast(t('notices.added', { c }));
    }
  };

  const typeCards = FILTERS.map(f => {
    const arr = base.filter(n => match(n, f));
    const sub = f === 'all' ? t('notices.subToday', { n: String(arr.filter(n => dayKey(n.time) === today).length) })
      : f === 'listing' ? t('notices.subRecent', { n: String(arr.length) })
        : t('notices.subRisk', { d: String(arr.filter(n => n.kind === 'delisting').length), w: String(arr.filter(n => n.kind === 'warning').length) });
    const dot = f === 'all' ? 'text.secondary' : f === 'listing' ? pal.kind.listing : pal.kind.delisting;
    return { f, n: arr.length, sub, dot };
  });

  return (
    <Stack gap={3.5} sx={{ maxWidth: 1040, mx: 'auto', pt: { md: 3 }, pb: 8 }}>
      <Stack gap={1.5}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.4px', color: 'primary.main' }}>UPBIT · BITHUMB</Typography>
        <Typography component="h1" sx={{ m: 0, fontSize: { xs: 28, md: 36 }, fontWeight: 800, letterSpacing: '-1px' }}>{t('notices.title')}</Typography>
        <Typography sx={{ maxWidth: 640, fontSize: 15.5, lineHeight: 1.65, color: 'text.secondary' }}>{t('notices.intro')}</Typography>
      </Stack>

      {/* 종류별 요약 카드 (누르면 그 종류만) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
        {typeCards.map(c => (
          <Box key={c.f} component="button" type="button" onClick={() => setFilter(c.f)} aria-pressed={filter === c.f} sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.25, px: 2.5, py: 2.25, borderRadius: '16px', cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left', bgcolor: 'background.paper', transition: 'all .2s',
            border: '1.5px solid', borderColor: filter === c.f ? 'primary.main' : 'divider',
            boxShadow: filter === c.f ? (th: any) => `0 0 0 4px ${th.palette.ui.highlight.bg}` : 'none',
            '&:hover': { borderColor: 'primary.main' },
          }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ fontSize: 14, fontWeight: 700, color: 'text.secondary' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.dot }} />{t(`notices.filter.${c.f}` as TKey)}
            </Stack>
            <Stack direction="row" alignItems="baseline" gap={1}>
              <Typography component="span" sx={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', color: 'text.primary' }}>{c.n}</Typography>
              <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{c.sub}</Typography>
            </Stack>
          </Box>
        ))}
      </Box>

      {/* 거래소 · 홈 모니터 수 · 검색 (스크롤해도 위에 붙어 있다) */}
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{
        position: 'sticky', top: 92, zIndex: 5, mx: -2, px: 2, py: 1.5, borderRadius: '16px', backdropFilter: 'blur(14px)',
        bgcolor: (th: any) => (th.palette.mode === 'dark' ? 'rgba(22,25,31,0.85)' : 'rgba(255,255,255,0.85)'),
      }}>
        <Stack direction="row" gap={0.25} sx={{ p: 0.5, borderRadius: '12px', bgcolor: 'ui.pill.bg' }}>
          {(['all', 'upbit', 'bithumb'] as const).map(ex => (
            <Box key={ex} component="button" type="button" onClick={() => setExchange(ex)} aria-pressed={exchange === ex} sx={segBtn(exchange === ex)}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ex === 'all' ? 'text.secondary' : pal.ex[ex] }} />
              {ex === 'all' ? t('notices.allExchanges') : t(`notices.ex.${ex}` as TKey)}
            </Box>
          ))}
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>
          {t('notices.monitorPre')} <Box component="b" sx={{ color: 'primary.main' }}>{watched.length}</Box>{t('notices.monitorPost')}
        </Typography>
        <Stack direction="row" alignItems="center" gap={1} sx={{ width: { xs: '100%', sm: 260 }, height: 42, px: 1.75, borderRadius: '12px', bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
          <Box component="svg" viewBox="0 0 20 20" aria-hidden sx={{ width: 16, height: 16, flexShrink: 0, color: 'text.secondary' }}>
            <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </Box>
          <Box component="input" value={query} placeholder={t('notices.search')} aria-label={t('notices.search')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            sx={{ flex: 1, minWidth: 0, border: 0, outline: 0, bgcolor: 'transparent', color: 'text.primary', fontFamily: 'inherit', fontSize: 14.5, '&::placeholder': { color: 'text.secondary', opacity: 1 } }} />
        </Stack>
      </Stack>

      {loading && !data && <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>…</Typography>}
      {error && !data && <Typography color="error" sx={{ py: 6, textAlign: 'center' }}>{error}</Typography>}
      {data && list.length === 0 && (
        <Box sx={{ py: 10, textAlign: 'center', fontSize: 15, color: 'text.secondary', border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: '16px' }}>{t('notices.empty')}</Box>
      )}

      {/* 날짜별 타임라인 */}
      <Stack gap={4.5}>
        {groups.map(g => {
          const isToday = g.key === today;
          const head = isToday ? t('notices.today') : g.key === yesterday ? t('notices.yesterday') : null;
          return (
            <Box component="section" key={g.key}>
              <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1.25 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', color: isToday ? 'primary.main' : 'text.primary' }}>{head ?? dateLabel(g.key)}</Typography>
                {head && <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{dateLabel(g.key)}</Typography>}
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>{t('notices.count', { n: String(g.items.length) })}</Typography>
              </Stack>
              {g.items.map((n, i) => {
                const kindColor = n.kind !== 'other' ? pal.kind[n.kind] : null;
                const isNew = now - n.time < DAY;
                const last = i === g.items.length - 1;
                return (
                  <Box key={n.url + n.time} sx={{ display: 'grid', gridTemplateColumns: { xs: '44px 16px minmax(0,1fr)', sm: '56px 20px minmax(0,1fr)' }, gap: { xs: 1, sm: 1.75 } }}>
                    <Typography sx={{ pt: 2.5, textAlign: 'right', fontSize: 14, fontWeight: 700, color: isNew ? 'text.primary' : 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{hhmm(n.time)}</Typography>
                    {/* 세로선과 점: 상장·종료·유의는 색을 채운 점 */}
                    <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                      <Box sx={{ position: 'absolute', top: i ? 0 : 28, bottom: last ? 'calc(100% - 28px)' : 0, left: '50%', width: 2, ml: '-1px', bgcolor: 'divider' }} />
                      <Box sx={{
                        position: 'relative', mt: 3, width: 12, height: 12, boxSizing: 'border-box', borderRadius: '50%',
                        bgcolor: kindColor ?? 'background.paper', border: '2.5px solid', borderColor: kindColor ?? 'text.secondary',
                        boxShadow: (th: any) => `0 0 0 4px ${th.palette.background.default}`,
                      }} />
                    </Box>
                    <Stack gap={1.25} sx={{
                      my: 0.5, px: 2.5, py: 2, borderRadius: '14px', border: 1, borderColor: 'transparent', transition: 'all .15s', minWidth: 0,
                      '&:hover': { bgcolor: 'background.paper', borderColor: 'divider', boxShadow: '0 6px 20px rgba(18,21,26,0.06)' },
                    }}>
                      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.25} sx={{ fontSize: 13 }}>
                        <Stack direction="row" alignItems="center" gap={0.75} sx={{ fontWeight: 700, color: pal.ex[n.exchange] }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: pal.ex[n.exchange] }} />{t(`notices.ex.${n.exchange}` as TKey)}
                        </Stack>
                        {n.category && <><Box component="span" sx={{ color: 'divider' }}>/</Box><Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>{n.category}</Box></>}
                        {kindColor && (
                          <Box component="span" sx={{ height: 24, px: 1.25, borderRadius: 99, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 800, color: kindColor, bgcolor: `${kindColor}24` }}>
                            {t(`notices.kind.${n.kind}` as TKey)}
                          </Box>
                        )}
                        {isNew && <Box component="span" sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: 'primary.main' }}>NEW</Box>}
                      </Stack>
                      <Link href={n.url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ color: 'text.primary', fontSize: 17, fontWeight: 650, lineHeight: 1.5, letterSpacing: '-0.2px', wordBreak: 'keep-all' }}>
                        {n.title}
                      </Link>
                      {n.coins.length > 0 && (
                        <Stack direction="row" flexWrap="wrap" gap={0.75}>
                          {n.coins.map(c => {
                            const on = watched.includes(c);
                            return (
                              <Box key={c} component="button" type="button" onClick={() => toggleCoin(c)} aria-pressed={on} title={on ? t('notices.unwatch') : t('notices.watch')} sx={{
                                height: 30, pl: 1.25, pr: 1.5, borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: 0.75, transition: 'all .15s', border: 1,
                                borderColor: on ? 'primary.main' : 'divider', bgcolor: on ? 'primary.main' : 'background.paper', color: on ? '#fff' : 'text.primary',
                              }}>
                                <Box component="span" sx={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>{on ? '✓' : '+'}</Box>{c}
                              </Box>
                            );
                          })}
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Stack>

      {/* 홈 모니터에 넣고 뺐을 때 알림 */}
      {toast && (
        <Stack direction="row" alignItems="center" gap={1.25} role="status" sx={{
          position: 'fixed', left: '50%', bottom: 36, transform: 'translateX(-50%)', zIndex: 1300, height: 48, pl: 2.5, pr: 1, borderRadius: 99,
          bgcolor: 'rgba(18,21,26,0.92)', backdropFilter: 'blur(10px)', color: '#fff', fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap',
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        }}>
          {toast}
          <Box component={RouterLink} to="/#monitor" sx={{ height: 32, px: 1.75, borderRadius: 99, bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            {t('notices.viewHome')}
          </Box>
        </Stack>
      )}
    </Stack>
  );
};

export default Notices;
