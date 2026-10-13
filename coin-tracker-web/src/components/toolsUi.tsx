import React from 'react';
import { Box, ButtonBase, Stack } from '@mui/material';

/**
 * 트레이딩 도구 패널(차익 계산기·김프 알림)에서 쓰는 작은 입력 요소들
 * 라이트/다크 테마 모두에서 보이도록 색은 테마 값을 쓴다.
 */
export const inputBorder = { border: 1, borderColor: 'ui.card.border', borderRadius: '10px', bgcolor: 'background.paper' } as const;

/** 위에 작은 라벨이 붙은 입력 칸 */
export const Field: React.FC<{ label: React.ReactNode; small?: boolean; children: React.ReactNode }> = ({ label, small, children }) => (
  <Box component="label" sx={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: small ? 11 : 12, fontWeight: 500, color: 'text.secondary', minWidth: 0 }}>
    {label}
    {children}
  </Box>
);

/** 기본 select (모바일에서도 OS 선택창을 쓰도록 native) */
export const Select: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ value, onChange, options }) => (
  <Box component="select" value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
    sx={{ ...inputBorder, height: 40, px: 1, fontSize: 14, color: 'text.primary', fontFamily: 'inherit', minWidth: 0, width: '100%', cursor: 'pointer' }}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </Box>
);

/** 회색 바탕 위 흰 버튼이 선택을 나타내는 토글 (탭, ≥/≤ 등) */
export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[];
}) {
  return (
    <Stack direction="row" sx={{ bgcolor: 'ui.pill.bg', borderRadius: '10px', p: '3px', flexShrink: 0 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <ButtonBase key={o.value} onClick={() => onChange(o.value)}
            sx={{
              height: 34, px: 1.6, borderRadius: '8px', fontSize: 14, fontWeight: 600, gap: 0.8, fontFamily: 'inherit',
              bgcolor: on ? 'background.paper' : 'transparent', color: on ? 'text.primary' : 'text.secondary',
              boxShadow: on ? '0 1px 3px rgba(17,24,39,.08)' : 'none',
            }}>
            {o.label}
          </ButtonBase>
        );
      })}
    </Stack>
  );
}

/** 작은 숫자 배지 (알림 개수 등) */
export const CountBadge: React.FC<{ n: number }> = ({ n }) => (
  <Box component="span" sx={{ bgcolor: 'ui.highlight.bg', color: 'primary.main', fontSize: 11, fontWeight: 700, px: '7px', py: '1px', borderRadius: 99, lineHeight: 1.5 }}>{n}</Box>
);
