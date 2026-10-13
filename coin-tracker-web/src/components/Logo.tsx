import React, { useId } from 'react';
import { Box, Stack } from '@mui/material';

/** 로고 심볼: 파란 그라데이션 둥근 사각형 + 코인 테두리 + 오르는 추세선 (public/favicon.svg와 같은 모양) */
export const LogoMark: React.FC<{ size?: number }> = ({ size = 28 }) => {
  const id = useId().replace(/:/g, '');
  return (
    <Box component="svg" viewBox="0 0 32 32" width={size} height={size} aria-hidden sx={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id={`lg${id}`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5ea2ff" />
          <stop offset="1" stopColor="#2f6ef0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#lg${id})`} />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
      <polyline points="9.5,19.5 14,15 17,18 22.5,12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22.5" cy="12" r="2.2" fill="#fff" />
    </Box>
  );
};

/** Coin Tracker 글자 ("Tracker"는 파란색) */
export const Wordmark: React.FC<{ fontSize?: number | Record<string, number> }> = ({ fontSize = 20 }) => (
  <Box component="span" sx={{ fontSize, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, whiteSpace: 'nowrap' }}>
    Coin<Box component="span" sx={{ color: 'primary.main' }}>Tracker</Box>
  </Box>
);

/** 로고 (심볼 + Coin Tracker 글자) */
const Logo: React.FC<{ size?: number; fontSize?: number }> = ({ size = 28, fontSize = 20 }) => (
  <Stack direction="row" alignItems="center" gap={1} sx={{ fontSize, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, whiteSpace: 'nowrap' }}>
    <LogoMark size={size} />
    <Box component="span">
      Coin<Box component="span" sx={{ color: 'primary.main' }}>Tracker</Box>
    </Box>
  </Stack>
);

export default Logo;
