import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, IconButton, Snackbar, Stack, Tooltip, Typography } from '@mui/material';
import SidebarLayout from './SidebarLayout';
import SidebarMenu from './SidebarMenu';
import VsCard from './VsCard';
import { useI18n, TKey } from '../i18n';
import { CatalogGroup, CatalogItem } from '../lib/catalog';
import { storage } from '../lib/chartUtils';

const GROUP_ORDER: CatalogGroup[] = ['crypto', 'derivatives', 'premium', 'indices', 'commodity', 'mining', 'trending'];

interface Props {
  /** 사이드바 제목 / 헤더 왼쪽 이름 (예: Bitcoin) */
  name: string;
  /** 사이드바 제목 (예: Bitcoin VS, Markets) */
  menuTitle: string;
  base?: CatalogItem;
  items: CatalogItem[];
  /** 즐겨찾기 저장 키 */
  storageKey: string;
  titleFor: (item: CatalogItem) => string;
}

/** BTC / ETH / 마켓 페이지 공통: 사이드바 + 비교 카드 그리드 */
const CardGridPage: React.FC<Props> = ({ name, menuTitle, base, items, storageKey, titleFor }) => {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const selected = params.get('item');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => storage.get(storageKey, []));
  const [customOnly, setCustomOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(next);
    storage.set(storageKey, next);
  };

  const embed = async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?item=${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch { /* 클립보드 권한 없음 */ }
  };

  const select = (id: string | null) => setParams(id ? { item: id } : {}, { replace: true });

  const groups = GROUP_ORDER
    .map(g => ({ key: g, title: t(`group.${g}` as TKey), items: items.filter(i => i.group === g).map(i => ({ id: i.id, label: i.label })) }))
    .filter(g => g.items.length);

  // ?item=이 있으면 그 차트 하나를 상세 화면으로 크게 보여 준다 (카드 클릭·사이드바·임베드 링크 공통)
  const detailItem = selected ? items.find(i => i.id === selected) : undefined;
  const visible = items.filter(i => !customOnly || favorites.includes(i.id));
  const selectedLabel = detailItem?.short ?? null;
  const open = (id: string) => { setParams({ item: id }); window.scrollTo(0, 0); };

  return (
    <SidebarLayout sidebar={
      <SidebarMenu
        title={menuTitle}
        groups={groups}
        query={query}
        onQueryChange={setQuery}
        selected={selected}
        onSelect={select}
        allLabel={t('cards.all')}
        total={items.length}
        searchPlaceholder={t('cards.search')}
      />
    }>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2.5 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: '50%', border: 1, borderColor: 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>☰</Box>
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>
          {base && <Box component="span" sx={{ color: 'text.secondary' }}>{name} </Box>}
          {base && <Box component="span" sx={{ color: 'text.secondary' }}>VS </Box>}
          <Box component="span" sx={{ color: '#3d6cf4' }}>{selectedLabel ?? (base ? t('cards.all') : name)}</Box>
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('cards.custom')}</Typography>
        <Tooltip title={t('cards.customHelp')}>
          <IconButton size="small" onClick={() => setCustomOnly(v => !v)}
            sx={{ border: 1, borderColor: customOnly ? '#3d6cf4' : 'divider', color: customOnly ? '#3d6cf4' : 'text.secondary' }}>⚙</IconButton>
        </Tooltip>
      </Stack>

      {detailItem ? (
        <VsCard key={detailItem.id} detail title={titleFor(detailItem)} base={base} target={detailItem}
          favorite={favorites.includes(detailItem.id)} onToggleFavorite={() => toggleFavorite(detailItem.id)} onEmbed={() => embed(detailItem.id)}
          onBack={() => select(null)} />
      ) : visible.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>{t('cards.empty')}</Typography>
      ) : (
        // 화면 폭에 따라 열 수가 늘어난다 (넓은 화면에서 4열 이상)
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(300px, 1fr))' }, gap: 2.5 }}>
          {visible.map(item => (
            <VsCard key={item.id} title={titleFor(item)} base={base} target={item}
              favorite={favorites.includes(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} onEmbed={() => embed(item.id)}
              onOpen={() => open(item.id)} />
          ))}
        </Box>
      )}
      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} message={t('common.copied')} />
    </SidebarLayout>
  );
};

export default CardGridPage;
