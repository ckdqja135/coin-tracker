import React from 'react';
import { Box } from '@mui/material';

/** 왼쪽 어두운 사이드바 + 본문 (BTC/ETH/마켓/비교 차트 페이지 공통) */
const SidebarLayout: React.FC<{ sidebar: React.ReactNode; children: React.ReactNode }> = ({ sidebar, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 'calc(100vh - 86px)' }}>
    <Box component="aside" sx={{
      width: 220, flexShrink: 0, bgcolor: '#16171a', color: '#cfd3da', px: 3, py: 4, display: { xs: 'none', md: 'block' },
    }}>
      <Box sx={{ position: 'sticky', top: 110 }}>{sidebar}</Box>
    </Box>
    <Box sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 5 }, py: 3 }}>
      <Box sx={{ maxWidth: 1000, mx: { lg: 'auto' }, ml: { lg: 0 } }}>{children}</Box>
    </Box>
  </Box>
);

export default SidebarLayout;
