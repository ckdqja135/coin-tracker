import React, { useState } from 'react';
import { Box, Button, Drawer } from '@mui/material';
import { useI18n } from '../i18n';

/** 왼쪽 어두운 사이드바 + 본문 (BTC/ETH/마켓/비교 차트 페이지 공통). 모바일에서는 버튼으로 여는 서랍 */
const SidebarLayout: React.FC<{ sidebar: React.ReactNode; children: React.ReactNode }> = ({ sidebar, children }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 'calc(100vh - 86px)' }}>
      <Box component="aside" sx={{
        width: 220, flexShrink: 0, bgcolor: '#16171a', color: '#cfd3da', px: 3, py: 4, display: { xs: 'none', md: 'block' },
      }}>
        <Box sx={{ position: 'sticky', top: 110 }}>{sidebar}</Box>
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 5 }, py: 3 }}>
        <Button onClick={() => setOpen(true)} size="small"
          sx={{ display: { xs: 'inline-flex', md: 'none' }, mb: 2, bgcolor: '#16171a', color: '#fff', px: 1.5, '&:hover': { bgcolor: '#2c2e33' } }}>
          ☰ {t('cards.menu')}
        </Button>
        <Box sx={{ maxWidth: 1000 }}>{children}</Box>
      </Box>
      <Drawer open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { bgcolor: '#16171a', color: '#cfd3da', width: 260, px: 3, py: 3 } }}>
        {/* 항목을 고르면 닫히도록 클릭을 위임 */}
        <Box onClick={e => { if ((e.target as HTMLElement).closest('[data-menu-item]')) setOpen(false); }}>{sidebar}</Box>
      </Drawer>
    </Box>
  );
};

export default SidebarLayout;
