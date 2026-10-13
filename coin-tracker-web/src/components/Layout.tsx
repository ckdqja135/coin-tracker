import React, { useState } from 'react';
import { Link as RouterLink, NavLink, useLocation } from 'react-router-dom';
import {
  AppBar, Box, Button, Container, Drawer, IconButton, Link, List, ListItemButton, ListItemText,
  MenuItem, Paper, Select, Stack, Toolbar, Tooltip, Typography,
} from '@mui/material';
import { useI18n, TKey } from '../i18n';
import { storage } from '../lib/chartUtils';
import { useThemeMode } from '../lib/themeMode';
import ChatWidget from './ChatWidget';
import TickerBar from './TickerBar';

// 헤더 메뉴 (로고가 홈 링크 역할)
export const NAV: { to: string; key: TKey }[] = [
  { to: '/btc', key: 'nav.btc' },
  { to: '/eth', key: 'nav.eth' },
  { to: '/markets', key: 'nav.markets' },
  { to: '/compare', key: 'nav.compare' },
  { to: '/longs-shorts', key: 'nav.longshort' },
  { to: '/correlation', key: 'nav.correlation' },
  { to: '/notices', key: 'nav.notices' },
  { to: '/blog', key: 'nav.blog' },
  { to: '/calendar', key: 'nav.calendar' },
];

const LangToggle: React.FC = () => {
  const { lang, setLang } = useI18n();
  return (
    <Select size="small" value={lang} onChange={e => setLang(e.target.value as 'en' | 'ko')} variant="standard" disableUnderline
      sx={{ bgcolor: 'ui.pill.bg', color: 'ui.pill.fg', borderRadius: 99, px: 1.5, fontSize: 12, fontWeight: 700, '& .MuiSvgIcon-root': { color: 'ui.pill.fg' } }}>
      <MenuItem value="en">EN</MenuItem>
      <MenuItem value="ko">KO</MenuItem>
    </Select>
  );
};

const ThemeToggle: React.FC = () => {
  const { t } = useI18n();
  const { mode, toggle } = useThemeMode();
  const icon = (active: boolean) => ({ color: active ? 'ui.header.active' : 'ui.header.muted', fontSize: 15, lineHeight: 1, transition: 'color .2s' });
  // 달/해를 나란히 두고 현재 모드를 밝게 표시
  return (
    <Tooltip title={t('theme.toggle')}>
      <IconButton size="small" onClick={toggle} aria-label={t('theme.toggle')} sx={{ gap: 0.6, borderRadius: 99, px: 1 }}>
        <Box component="span" sx={icon(mode === 'dark')}>☾</Box>
        <Box component="span" sx={icon(mode === 'light')}>☀</Box>
      </IconButton>
    </Tooltip>
  );
};

const Header: React.FC = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'ui.header.bg', color: 'ui.header.fg', borderBottom: 1, borderColor: 'ui.header.border' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2, minHeight: { xs: 56 } }}>
          <IconButton sx={{ display: { md: 'none' }, color: 'ui.header.fg' }} onClick={() => setOpen(true)} aria-label="menu">☰</IconButton>
          <Typography component={RouterLink} to="/" variant="h6"
            sx={{ fontWeight: 800, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap', letterSpacing: -0.5 }}>
            <Box component="span" sx={{ bgcolor: 'primary.main', color: '#fff', borderRadius: 1, px: 0.5, mr: 0.8, fontSize: 15 }}>◆</Box>Coin Tracker
          </Typography>
          <Stack direction="row" justifyContent="center" sx={{ display: { xs: 'none', md: 'flex' }, flexGrow: 1 }}>
            {NAV.map(n => (
              <Button key={n.to} component={NavLink} to={n.to} color="inherit"
                sx={{ fontSize: 13, fontWeight: 600, color: 'ui.header.fg', px: 1.3, '&.active': { color: 'ui.header.active' } }}>
                {t(n.key)}
              </Button>
            ))}
          </Stack>
          <Box sx={{ flexGrow: { xs: 1, md: 0 } }} />
          <LangToggle />
          <ThemeToggle />
        </Toolbar>
      </Container>

      <Drawer open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 260, p: 2 }}>
          <List>
            {NAV.map(n => (
              <ListItemButton key={n.to} component={NavLink} to={n.to} onClick={() => setOpen(false)}>
                <ListItemText primary={t(n.key)} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
      <TickerBar />
    </AppBar>
  );
};

const Footer: React.FC<{ full?: boolean }> = ({ full }) => {
  const { t } = useI18n();
  const col = (title: string, links: { to: string; label: string }[]) => (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'ui.footer.title' }}>{title}</Typography>
      <Stack spacing={0.5}>
        {links.map(l => (
          <Link key={l.to + l.label} component={RouterLink} to={l.to} underline="hover" fontSize={13} sx={{ color: 'ui.footer.fg' }}>{l.label}</Link>
        ))}
      </Stack>
    </Box>
  );

  return (
    <Box component="footer" sx={{ mt: full ? 0 : 8, pt: 4, pb: 2.5, bgcolor: 'ui.footer.bg', color: 'ui.footer.title', borderTop: 1, borderColor: 'ui.footer.border' }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={6}>
          <Box sx={{ maxWidth: 320 }}>
            <Typography sx={{ fontWeight: 800 }}><Box component="span" sx={{ bgcolor: 'primary.main', color: '#fff', borderRadius: 1, px: 0.5, mr: 0.8 }}>◆</Box>Coin Tracker</Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'ui.footer.muted' }}>{t('footer.disclaimer')}</Typography>
          </Box>
          {col(t('footer.company'), [
            { to: '/about', label: t('nav.about') },
            { to: '/policy', label: t('nav.policy') },
            { to: '/about#contact', label: t('nav.contact') },
          ])}
          {col(t('footer.service'), NAV.slice(0, 4).map(n => ({ to: n.to, label: t(n.key) })))}
          {col(' ', NAV.slice(4).map(n => ({ to: n.to, label: t(n.key) })))}
        </Stack>
      </Container>
      {/* 하단 줄: 저작권 | 문의 | 언어 선택 */}
      <Box sx={{ borderTop: 1, borderColor: 'ui.footer.border', mt: 4, pt: 2.5 }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ fontSize: 11, color: 'ui.footer.muted' }}>
            <span>COPYRIGHTS © {new Date().getFullYear()} Coin Tracker</span>
            <Box component="span" sx={{ color: 'ui.footer.fg', fontWeight: 700 }}>|</Box>
            <Link component={RouterLink} to="/about#contact" underline="hover" sx={{ color: 'ui.footer.fg', fontSize: 11 }}>✉ {t('nav.contact')}</Link>
            <Box sx={{ flexGrow: 1 }} />
            <span>{t('footer.language')}</span>
            <LangToggle />
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

const CookieBanner: React.FC = () => {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => !storage.get('cookieAck', false));
  if (!visible) return null;
  return (
    <Paper elevation={6} sx={{ position: 'fixed', bottom: 16, left: 16, right: 16, mx: 'auto', maxWidth: 560, p: 2, zIndex: 1300,
      display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography variant="body2" sx={{ flexGrow: 1 }}>{t('cookie.text')}</Typography>
      <Button variant="contained" size="small" onClick={() => { storage.set('cookieAck', true); setVisible(false); }}>{t('cookie.ok')}</Button>
    </Paper>
  );
};

// 왼쪽 사이드바가 화면 끝까지 붙는 페이지
const FULL_WIDTH = ['/btc', '/eth', '/markets', '/compare'];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const full = FULL_WIDTH.includes(pathname);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      {full
        ? <Box component="main" sx={{ flexGrow: 1 }}>{children}</Box>
        : <Container maxWidth="lg" component="main" sx={{ flexGrow: 1, py: 3 }}>{children}</Container>}
      <Footer full={full} />
      <CookieBanner />
      <ChatWidget />
    </Box>
  );
};

export default Layout;
