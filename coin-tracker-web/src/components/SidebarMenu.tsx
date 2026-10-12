import React, { useState } from 'react';
import { Box, Checkbox, Collapse, InputBase, Stack, Typography } from '@mui/material';

export interface MenuGroup {
  key: string;
  title: string;
  items: { id: string; label: string }[];
}

interface Props {
  title: string;
  groups: MenuGroup[];
  query: string;
  onQueryChange: (q: string) => void;
  /** 단일 선택 메뉴 (카드 페이지) */
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** 체크박스 메뉴 (비교 차트) */
  checked?: string[];
  onToggle?: (id: string) => void;
  allLabel?: string;
  total?: number;
  searchPlaceholder: string;
  /** 검색창을 숨긴다 */
  hideSearch?: boolean;
  /** 항목 사이에 구분선을 넣는다 */
  divided?: boolean;
  /** 제목 아래에 넣을 영역 (예: 초기화 + 개수) */
  header?: React.ReactNode;
}

const SidebarMenu: React.FC<Props> = ({
  title, groups, query, onQueryChange, selected, onSelect, checked, onToggle, allLabel, total, searchPlaceholder,
  hideSearch, divided, header,
}) => {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  return (
    <Box>
      <Typography sx={{ fontWeight: 800, fontSize: 15, color: 'ui.sidebar.title', mb: 2.5 }}>{title}</Typography>
      {header}
      {!hideSearch && (
        <Box sx={{ border: 1, borderColor: 'ui.sidebar.inputBorder', borderRadius: 99, px: 1.5, py: 0.3, display: 'flex', alignItems: 'center', mb: 2 }}>
          <InputBase value={query} onChange={e => onQueryChange(e.target.value)} placeholder={searchPlaceholder}
            sx={{ flexGrow: 1, color: 'ui.sidebar.title', fontSize: 12 }} />
          <span style={{ fontSize: 12 }}>🔍</span>
        </Box>
      )}

      {onSelect && (
        <Stack direction="row" alignItems="center" onClick={() => onSelect(null)} data-menu-item=""
          sx={{
            py: 1, px: 1, borderRadius: 1.5, cursor: 'pointer', fontSize: 12, fontWeight: selected == null ? 700 : 400,
            color: selected == null ? 'ui.sidebar.activeFg' : 'ui.sidebar.fg', bgcolor: selected == null ? 'ui.sidebar.activeBg' : 'transparent',
          }}>
          <span style={{ marginRight: 8 }}>⠿</span>
          <Box sx={{ flexGrow: 1 }}>{allLabel}</Box>
          <Box sx={{ bgcolor: 'ui.sidebar.badgeBg', color: 'ui.sidebar.badgeFg', borderRadius: 99, px: 1.2, fontSize: 11, fontWeight: 700 }}>{total}</Box>
        </Stack>
      )}

      {groups.map(g => {
        const items = g.items.filter(i => !q || i.label.toLowerCase().includes(q));
        if (!items.length) return null;
        return (
          <Box key={g.key} sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" onClick={() => setClosed(c => ({ ...c, [g.key]: !c[g.key] }))}
              sx={{ cursor: 'pointer', color: 'ui.sidebar.group', fontSize: 12, fontWeight: 700, mb: 0.5 }}>
              <Box sx={{ flexGrow: 1 }}>{g.title}</Box>
              <span style={{ fontSize: 9 }}>{closed[g.key] ? '▼' : '▲'}</span>
            </Stack>
            <Collapse in={!closed[g.key]}>
              {items.map(it => {
                const isChecked = checked?.includes(it.id);
                return (
                  <Stack key={it.id} direction="row" alignItems="center" data-menu-item={onToggle ? undefined : ''}
                    onClick={() => (onToggle ? onToggle(it.id) : onSelect?.(it.id))}
                    sx={{
                      pl: 1.5, pr: 1, py: 1, borderRadius: divided ? 0 : 1.5, cursor: 'pointer', fontSize: 11.5,
                      borderBottom: divided ? 1 : 0, borderColor: 'ui.sidebar.border',
                      fontWeight: selected === it.id || isChecked ? 700 : 400,
                      color: selected === it.id || isChecked ? 'ui.sidebar.activeFg' : 'ui.sidebar.fg',
                      bgcolor: selected === it.id ? 'ui.sidebar.activeBg' : 'transparent',
                      '&:hover': { color: 'ui.sidebar.activeFg', bgcolor: 'ui.sidebar.activeBg' },
                    }}>
                    <Box sx={{ flexGrow: 1 }}>{it.label}</Box>
                    {onToggle && (
                      <Checkbox size="small" checked={!!isChecked} sx={{ p: 0, color: 'ui.sidebar.muted', '&.Mui-checked': { color: 'ui.sidebar.group' } }} />
                    )}
                  </Stack>
                );
              })}
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
};

export default SidebarMenu;
