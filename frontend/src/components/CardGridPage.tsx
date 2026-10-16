import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Drawer, Stack, Tooltip, Typography } from '@mui/material';
import CoinIcon from './CoinIcon';
import VsCard from './VsCard';
import { useI18n, TKey } from '../i18n';
import { CardRange, CatalogGroup, CatalogItem } from '../lib/catalog';
import { storage } from '../lib/chartUtils';

const GROUP_ORDER: CatalogGroup[] = ['crypto', 'derivatives', 'premium', 'indices', 'commodity', 'mining', 'trending'];
const RANGES: CardRange[] = ['1D', '1W', '1M', '1Y'];
const SIDEBAR_W = 264;
/** 고정 헤더(메뉴 + 티커 바) 높이: 사이드바를 그 아래에 붙인다 */
const HEADER_H = 92;
const BASE_LINE = '#6b6f76';
const TARGET_LINE = '#3d6cf4';

interface Props {
  /** 헤더 왼쪽 이름 (예: Bitcoin) */
  name: string;
  /** 사이드바 제목 (예: Bitcoin VS, Markets) */
  menuTitle: string;
  /** 사이드바 제목 옆 코인 로고 */
  icon?: string;
  base?: CatalogItem;
  items: CatalogItem[];
  /** 즐겨찾기 저장 키 */
  storageKey: string;
  titleFor: (item: CatalogItem) => string;
}

/** 회색 바탕에 고른 것만 흰 버튼인 기간 탭 */
const Segmented: React.FC<{ value: CardRange | null; onChange: (r: CardRange) => void; label?: string }> = ({ value, onChange, label }) => (
  <Stack direction="row" alignItems="center" gap={0.5} sx={{ p: 0.5, borderRadius: '10px', bgcolor: 'ui.pill.bg' }}>
    {label && <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary', px: 1 }}>{label}</Typography>}
    {RANGES.map(r => (
      <Box key={r} component="button" type="button" onClick={() => onChange(r)} aria-pressed={r === value} sx={{
        height: 30, minWidth: 40, border: 0, borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
        bgcolor: r === value ? 'background.paper' : 'transparent', color: r === value ? 'text.primary' : 'text.secondary',
        boxShadow: r === value ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
      }}>{r}</Box>
    ))}
  </Stack>
);

/** BTC / ETH / 마켓 페이지 공통: 사이드바(검색·전체·내 차트·분류) + 비교 카드 그리드 + 상세 화면 */
const CardGridPage: React.FC<Props> = ({ name, menuTitle, icon, base, items, storageKey, titleFor }) => {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  // 보기: ?item= 상세, ?cat= 분류, ?mine=1 내 차트, 없으면 전체
  const selected = params.get('item');
  const cat = params.get('cat') as CatalogGroup | null;
  const mine = params.get('mine') === '1';
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => storage.get(storageKey, []));
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [sideOpen, setSideOpen] = useState<boolean>(() => storage.get('cardSidebarOpen', true));
  const [drawer, setDrawer] = useState(false);
  const [ranges, setRanges] = useState<Record<string, CardRange>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" 를 누르면 사이드바 검색창으로
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const toggleFavorite = (id: string) => setFavorites(cur => {
    const next = cur.includes(id) ? cur.filter(f => f !== id) : [...cur, id];
    storage.set(storageKey, next);
    return next;
  });

  const embed = async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?item=${encodeURIComponent(id)}`;
    try { await navigator.clipboard.writeText(url); } catch { /* 클립보드 권한 없음 */ }
    setCopied(id);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1500);
  };

  const go = (next: Record<string, string>, push = false) => {
    setParams(next, { replace: !push });
    setDrawer(false);
    window.scrollTo(0, 0);
  };
  const toggleSide = () => {
    // 휴대폰 폭에서는 서랍으로 연다
    if (window.matchMedia('(max-width: 899px)').matches) { setDrawer(true); return; }
    setSideOpen(v => { storage.set('cardSidebarOpen', !v); return !v; });
  };

  const q = query.trim().toLowerCase();
  const match = (i: CatalogItem) => !q || i.label.toLowerCase().includes(q) || i.short.toLowerCase().includes(q);
  const groupName = (g: CatalogGroup) => t(`group.${g}` as TKey);

  const detailItem = selected ? items.find(i => i.id === selected) : undefined;
  let list = items;
  let title = t('cards.all');
  if (mine) { list = items.filter(i => favorites.includes(i.id)); title = t('cards.custom'); }
  if (cat) { list = items.filter(i => i.group === cat); title = groupName(cat); }
  if (q) list = list.filter(match);
  if (detailItem) title = detailItem.short;

  // 보이는 카드가 모두 같은 기간이면 상단 "전체 기간" 탭에 그 기간을 표시한다
  const rangeOf = (i: CatalogItem) => ranges[i.id] ?? '1D';
  const common = list.length && list.every(i => rangeOf(i) === rangeOf(list[0])) ? rangeOf(list[0]) : null;
  const setAll = (r: CardRange) => setRanges(cur => ({ ...cur, ...Object.fromEntries(list.map(i => [i.id, r])) }));

  const navBtn = (active: boolean) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 38, px: 1.5, border: 0, borderRadius: '9px',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textAlign: 'left',
    bgcolor: active ? 'ui.highlight.bg' : 'transparent', color: active ? 'ui.highlight.fg' : 'text.secondary',
    '&:hover': { bgcolor: active ? 'ui.highlight.bg' : 'ui.pill.bg' },
  });

  const sidebar = (
    <Stack gap={2}>
      <Stack direction="row" alignItems="center" gap={1.25}>
        {icon && <CoinIcon symbol={icon} size={26} />}
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{menuTitle}</Typography>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{
        height: 52, pl: 2, pr: 1.25, borderRadius: '14px', transition: 'all .15s',
        bgcolor: searchFocus ? 'background.paper' : 'ui.pill.bg', border: '1.5px solid', borderColor: searchFocus ? 'primary.main' : 'transparent',
        boxShadow: searchFocus ? (th: any) => `0 0 0 4px ${th.palette.ui.highlight.bg}` : 'none',
      }}>
        <Box component="svg" viewBox="0 0 20 20" aria-hidden sx={{ width: 18, height: 18, flexShrink: 0, color: searchFocus ? 'primary.main' : 'text.secondary' }}>
          <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </Box>
        <Box component="input" ref={searchRef} value={query} placeholder={t('cards.searchPh')} aria-label={t('cards.searchPh')}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); } }}
          sx={{ flex: 1, minWidth: 0, border: 0, outline: 0, bgcolor: 'transparent', color: 'text.primary', fontFamily: 'inherit', fontSize: 16, fontWeight: 500, '&::placeholder': { color: 'text.secondary', opacity: 1 } }} />
        {query ? (
          <Box component="button" type="button" onClick={() => setQuery('')} aria-label="clear" sx={{
            width: 22, height: 22, flexShrink: 0, p: 0, border: 0, borderRadius: '50%', bgcolor: 'divider', color: 'text.secondary', fontSize: 10, cursor: 'pointer',
          }}>✕</Box>
        ) : (
          <Box component="span" sx={{
            flexShrink: 0, height: 22, minWidth: 22, px: 0.75, boxSizing: 'border-box', borderRadius: 1.5, border: 1, borderColor: 'divider',
            bgcolor: 'background.paper', color: 'text.secondary', fontSize: 11.5, fontWeight: 700, display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center',
          }}>/</Box>
        )}
      </Stack>
      <Stack gap={0.25}>
        <Box component="button" type="button" onClick={() => go({})} sx={navBtn(!mine && !cat && !detailItem)}>
          {t('cards.all')}<Box component="span" sx={{ fontSize: 12.5 }}>{items.length}</Box>
        </Box>
        <Box component="button" type="button" onClick={() => go({ mine: '1' })} sx={navBtn(mine)}>
          {t('cards.mine')}<Box component="span" sx={{ fontSize: 12.5 }}>{favorites.filter(f => items.some(i => i.id === f)).length}</Box>
        </Box>
      </Stack>
      {GROUP_ORDER.map(g => {
        const groupItems = items.filter(i => i.group === g && match(i));
        if (!groupItems.length) return null;
        const open = !closed[g] || !!q;
        const active = cat === g;
        return (
          <Stack key={g} gap={0.25}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Box component="button" type="button" onClick={() => go({ cat: g })} sx={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 1, height: 34, px: 1.25, border: 0, borderRadius: 2, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, textAlign: 'left', color: 'primary.main',
                bgcolor: active ? 'ui.highlight.bg' : 'transparent', '&:hover': { bgcolor: active ? 'ui.highlight.bg' : 'ui.pill.bg' },
              }}>
                {groupName(g)}
                <Box component="span" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{groupItems.length}</Box>
              </Box>
              <Tooltip title={t('cards.toggleGroup')}>
                <Box component="button" type="button" onClick={() => setClosed(c => ({ ...c, [g]: !c[g] }))} aria-expanded={open} sx={{
                  width: 28, height: 28, border: 0, bgcolor: 'transparent', color: 'text.secondary', fontSize: 10, cursor: 'pointer', borderRadius: 1.5,
                  '&:hover': { bgcolor: 'ui.pill.bg' },
                }}>{open ? '▲' : '▼'}</Box>
              </Tooltip>
            </Stack>
            {open && groupItems.map(i => {
              const on = i.id === selected;
              return (
                <Box key={i.id} component="button" type="button" onClick={() => go({ item: i.id }, true)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1, minHeight: 34, py: 0.75, pr: 1.25, pl: 2.5, border: 0, borderRadius: 2,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 500, textAlign: 'left',
                  bgcolor: on ? 'ui.highlight.bg' : 'transparent', color: on ? 'ui.highlight.fg' : 'text.secondary',
                  '&:hover': { bgcolor: on ? 'ui.highlight.bg' : 'ui.pill.bg' },
                }}>
                  <Box component="span" sx={{ flex: 1 }}>{i.label}</Box>
                  {favorites.includes(i.id) && <Box component="span" sx={{ color: '#ef5350', fontSize: 11 }}>♥</Box>}
                </Box>
              );
            })}
          </Stack>
        );
      })}
    </Stack>
  );

  const card = (i: CatalogItem, detail = false) => (
    <VsCard key={i.id} detail={detail} title={detail ? titleFor(i) : i.label} category={groupName(i.group)} base={base} target={i}
      favorite={favorites.includes(i.id)} onToggleFavorite={() => toggleFavorite(i.id)} onEmbed={() => embed(i.id)} copied={copied === i.id}
      range={rangeOf(i)} onRangeChange={r => setRanges(cur => ({ ...cur, [i.id]: r }))}
      onOpen={detail ? undefined : () => go({ item: i.id }, true)} onBack={detail ? () => go({}) : undefined} />
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', minHeight: `calc(100vh - ${HEADER_H}px)` }}>
      {sideOpen && (
        <Box component="aside" sx={{
          display: { xs: 'none', md: 'block' }, width: SIDEBAR_W, flexShrink: 0, position: 'sticky', top: HEADER_H,
          maxHeight: `calc(100vh - ${HEADER_H}px)`, overflowY: 'auto', boxSizing: 'border-box', pt: 3.5, pr: 2.5, pb: 5, pl: 3.5,
          borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', alignSelf: 'stretch',
        }}>
          {sidebar}
        </Box>
      )}
      <Drawer open={drawer} onClose={() => setDrawer(false)} PaperProps={{ sx: { width: 290, p: 3 } }}>{sidebar}</Drawer>

      <Stack component="main" gap={2.5} sx={{ flex: 1, minWidth: 0, px: { xs: 2, md: 5 }, pt: 3.5, pb: 15 }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.75}>
          <Tooltip title={t('cards.sidebar')}>
            <Box component="button" type="button" onClick={toggleSide} aria-label={t('cards.sidebar')} sx={{
              width: 38, height: 38, border: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.secondary', borderRadius: '10px', fontSize: 16, cursor: 'pointer',
            }}>≡</Box>
          </Tooltip>
          <Typography component="h1" sx={{ m: 0, fontSize: { xs: 22, md: 26 }, fontWeight: 800, letterSpacing: '-0.6px' }}>
            {base && <>{name} VS </>}
            <Box component="span" sx={{ color: 'primary.main' }}>{title}</Box>
          </Typography>
          {!detailItem && <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary' }}>{t('cards.count', { n: String(list.length) })}</Typography>}
          <Box sx={{ flex: 1 }} />
          {!detailItem && list.length > 0 && <Segmented value={common} onChange={setAll} label={t('cards.allRange')} />}
        </Stack>

        {base && !detailItem && (
          <Stack direction="row" alignItems="center" flexWrap="wrap" columnGap={2.25} rowGap={0.5} sx={{ fontSize: 13, color: 'text.secondary' }}>
            <Stack direction="row" alignItems="center" gap={0.75}><Box sx={{ width: 16, height: 3, borderRadius: 1, bgcolor: BASE_LINE }} />{base.label}</Stack>
            <Stack direction="row" alignItems="center" gap={0.75}><Box sx={{ width: 16, height: 3, borderRadius: 1, bgcolor: TARGET_LINE }} />{t('cards.compared')}</Stack>
            <Box component="span" sx={{ color: 'text.disabled' }}>{t('cards.normalized')}</Box>
          </Stack>
        )}

        {detailItem ? card(detailItem, true) : list.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center', fontSize: 15, color: 'text.secondary', bgcolor: 'background.paper', border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: '16px' }}>
            {mine && !q ? t('cards.empty') : t('cards.noMatch')}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(320px, 1fr))' }, gap: 2 }}>
            {list.map(i => card(i))}
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default CardGridPage;
