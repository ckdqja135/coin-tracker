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
}

const SidebarMenu: React.FC<Props> = ({
  title, groups, query, onQueryChange, selected, onSelect, checked, onToggle, allLabel, total, searchPlaceholder,
}) => {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  return (
    <Box>
      <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#fff', mb: 2.5 }}>{title}</Typography>
      <Box sx={{ border: '1px solid #3a3d44', borderRadius: 99, px: 1.5, py: 0.3, display: 'flex', alignItems: 'center', mb: 2 }}>
        <InputBase value={query} onChange={e => onQueryChange(e.target.value)} placeholder={searchPlaceholder}
          sx={{ flexGrow: 1, color: '#fff', fontSize: 12 }} />
        <span style={{ fontSize: 12 }}>🔍</span>
      </Box>

      {onSelect && (
        <Stack direction="row" alignItems="center" onClick={() => onSelect(null)}
          sx={{ py: 1, borderBottom: '1px solid #2a2c31', cursor: 'pointer', color: selected == null ? '#fff' : '#9aa1ad', fontSize: 12 }}>
          <span style={{ marginRight: 8 }}>⠿</span>
          <Box sx={{ flexGrow: 1 }}>{allLabel}</Box>
          <Box sx={{ bgcolor: '#23262d', color: '#6f9cff', borderRadius: 99, px: 1.2, fontSize: 11 }}>{total}</Box>
        </Stack>
      )}

      {groups.map(g => {
        const items = g.items.filter(i => !q || i.label.toLowerCase().includes(q));
        if (!items.length) return null;
        return (
          <Box key={g.key} sx={{ mt: 2 }}>
            <Stack direction="row" alignItems="center" onClick={() => setClosed(c => ({ ...c, [g.key]: !c[g.key] }))}
              sx={{ cursor: 'pointer', color: '#4f86ff', fontSize: 12, fontWeight: 600, mb: 0.5 }}>
              <Box sx={{ flexGrow: 1 }}>{g.title}</Box>
              <span style={{ fontSize: 9 }}>{closed[g.key] ? '▼' : '▲'}</span>
            </Stack>
            <Collapse in={!closed[g.key]}>
              {items.map(it => {
                const isChecked = checked?.includes(it.id);
                return (
                  <Stack key={it.id} direction="row" alignItems="center"
                    onClick={() => (onToggle ? onToggle(it.id) : onSelect?.(it.id))}
                    sx={{
                      pl: 1.5, py: 1, borderBottom: '1px solid #2a2c31', cursor: 'pointer', fontSize: 11.5,
                      color: selected === it.id || isChecked ? '#fff' : '#9aa1ad', '&:hover': { color: '#fff' },
                    }}>
                    <Box sx={{ flexGrow: 1 }}>{it.label}</Box>
                    {onToggle && (
                      <Checkbox size="small" checked={!!isChecked} sx={{ p: 0, color: '#5b6070', '&.Mui-checked': { color: '#4f86ff' } }} />
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
