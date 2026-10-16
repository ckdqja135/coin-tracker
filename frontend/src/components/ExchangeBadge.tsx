import React, { useState } from 'react';
import { Box } from '@mui/material';
import { ExchangeMeta } from '../lib/exchanges';

/** 거래소 로고 (public/exchanges/{id}.png). 이미지를 못 불러오면 이니셜 배지로 대신한다 */
const ExchangeBadge: React.FC<{ ex: ExchangeMeta; size?: number }> = ({ ex, size = 22 }) => {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <Box component="img" src={`${process.env.PUBLIC_URL}/exchanges/${ex.id}.png`} alt={ex.label} title={ex.label}
        onError={() => setFailed(true)}
        sx={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', objectFit: 'cover' }} />
    );
  }
  return (
    <Box component="span" sx={{
      width: size, height: size, borderRadius: '50%', bgcolor: ex.color, color: '#fff', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 800, flexShrink: 0,
    }}>
      {ex.label.slice(0, 2).toUpperCase()}
    </Box>
  );
};

export default ExchangeBadge;
