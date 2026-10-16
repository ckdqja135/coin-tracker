import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';

/** 업비트가 공개한 코인 로고 주소 (업비트 원화마켓 코인 대부분이 있다) */
export const upbitLogo = (symbol: string) => `https://static.upbit.com/logos/${symbol}.png`;

/**
 * 코인 로고: 업비트 로고 → (있으면) CoinGecko 이미지 → 심볼 첫 글자 순으로 대신한다.
 * fallback에는 CoinGecko 이미지 주소 등을 넘긴다.
 */
const CoinIcon: React.FC<{ symbol: string; size?: number; fallback?: string | null }> = ({ symbol, size = 18, fallback }) => {
  const sources = [upbitLogo(symbol), ...(fallback ? [fallback] : [])];
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [symbol, fallback]);
  if (idx < sources.length) {
    return (
      <Box component="img" src={sources[idx]} alt="" loading="lazy" onError={() => setIdx(i => i + 1)}
        sx={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', display: 'inline-block', verticalAlign: 'middle' }} />
    );
  }
  return (
    <Box component="span" sx={{
      width: size, height: size, borderRadius: '50%', bgcolor: 'ui.pill.bg', color: 'text.secondary', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, fontWeight: 800,
    }}>
      {symbol.slice(0, 1)}
    </Box>
  );
};

export default CoinIcon;
