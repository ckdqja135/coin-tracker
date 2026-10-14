import React from 'react';
import { Box } from '@mui/material';
import { ExchangeMeta } from '../lib/exchanges';

/** 거래소 로고 대신 쓰는 이니셜 배지 */
const ExchangeBadge: React.FC<{ ex: ExchangeMeta; size?: number }> = ({ ex, size = 22 }) => (
  <Box component="span" sx={{
    width: size, height: size, borderRadius: '50%', bgcolor: ex.color, color: '#fff', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 800, flexShrink: 0,
  }}>
    {ex.label.slice(0, 2).toUpperCase()}
  </Box>
);

export default ExchangeBadge;
