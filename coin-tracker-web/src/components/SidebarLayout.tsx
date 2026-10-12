import React, { useState } from 'react';
import { Box, Button, Drawer } from '@mui/material';
import { useI18n } from '../i18n';

// 헤더는 MUI lg 컨테이너(최대 1200px, 좌우 여백 24px)를 쓴다
const HEADER_MAX = 1200;
const GUTTER = 24;
const SIDEBAR_W = 220;

/** 왼쪽 어두운 사이드바 + 본문 (BTC/ETH/마켓/비교 차트 페이지 공통). 모바일에서는 버튼으로 여는 서랍 */
const SidebarLayout: React.FC<{ sidebar: React.ReactNode; children: React.ReactNode }> = ({ sidebar, children }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 'calc(100vh - 86px)' }}>
      <Box component="aside" sx={{
        width: SIDEBAR_W, flexShrink: 0, bgcolor: 'ui.sidebar.bg', color: 'ui.sidebar.fg', borderRight: 1, borderColor: 'ui.sidebar.border',
        px: 3, py: 4, display: { xs: 'none', md: 'block' },
      }}>
        <Box sx={{ position: 'sticky', top: 110 }}>{sidebar}</Box>
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 0 }, py: 3 }}>
        <Button onClick={() => setOpen(true)} size="small"
          sx={{ display: { xs: 'inline-flex', md: 'none' }, mb: 2, bgcolor: 'ui.pill.bg', color: 'ui.pill.fg', px: 1.5, '&:hover': { bgcolor: 'ui.pill.hover' } }}>
          ☰ {t('cards.menu')}
        </Button>
        {/* 본문 좌우 끝을 헤더 콘텐츠(lg 컨테이너) 좌우 끝에 맞춘다. 화면이 좁으면 사이드바 바로 옆에서 시작 */}
        <Box sx={{
          ml: { md: `max(40px, calc((100vw - ${HEADER_MAX}px) / 2 + ${GUTTER}px - ${SIDEBAR_W}px))` },
          mr: { md: `max(40px, calc((100vw - ${HEADER_MAX}px) / 2 + ${GUTTER}px))` },
        }}>
          {children}
        </Box>
      </Box>
      <Drawer open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { bgcolor: 'ui.sidebar.bg', color: 'ui.sidebar.fg', width: 260, px: 3, py: 3 } }}>
        {/* 항목을 고르면 닫히도록 클릭을 위임 */}
        <Box onClick={e => { if ((e.target as HTMLElement).closest('[data-menu-item]')) setOpen(false); }}>{sidebar}</Box>
      </Drawer>
    </Box>
  );
};

export default SidebarLayout;
