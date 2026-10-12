import React, { useState } from 'react';
import { Link as RouterLink, NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Autocomplete, Box, Button, Container, Drawer, IconButton, Link, List, ListItemButton, ListItemText,
  Paper, Stack, TextField, Toolbar, Typography, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useI18n, TKey } from '../i18n';
import { ASSETS, Asset } from '../lib/assets';
import { storage } from '../lib/chartUtils';

export const NAV: { to: string; key: TKey }[] = [
  { to: '/', key: 'nav.home' },
  { to: '/compare', key: 'nav.compare' },
  { to: '/btc', key: 'nav.btc' },
  { to: '/eth', key: 'nav.eth' },
  { to: '/markets', key: 'nav.markets' },
  { to: '/longs-shorts', key: 'nav.longshort' },
  { to: '/correlation', key: 'nav.correlation' },
  { to: '/blog', key: 'nav.blog' },
];

const MarketSearch: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Autocomplete<Asset>
      size="small"
      options={ASSETS}
      getOptionLabel={a => `${a.short} · ${a.name}`}
      noOptionsText={t('search.empty')}
      onChange={(_, a) => a && navigate(`/markets?asset=${a.id}`)}
      blurOnSelect
      clearOnBlur
      sx={{ width: { xs: '100%', md: 220 } }}
      renderInput={params => <TextField {...params} placeholder={`🔍 ${t('search.placeholder')}`} />}
    />
  );
};

const LangToggle: React.FC = () => {
  const { lang, setLang } = useI18n();
  return (
    <ToggleButtonGroup size="small" exclusive value={lang} onChange={(_, v) => v && setLang(v)}>
      <ToggleButton value="en" sx={{ px: 1, py: 0.3, fontSize: 12 }}>EN</ToggleButton>
      <ToggleButton value="ko" sx={{ px: 1, py: 0.3, fontSize: 12 }}>KO</ToggleButton>
    </ToggleButtonGroup>
  );
};

const Header: React.FC = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'rgba(11,14,20,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1d2430' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ gap: 2, minHeight: { xs: 56 } }}>
          <IconButton sx={{ display: { md: 'none' } }} onClick={() => setOpen(true)} aria-label="menu">☰</IconButton>
          <Typography component={RouterLink} to="/" variant="h6"
            sx={{ fontWeight: 800, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap', letterSpacing: -0.5 }}>
            <Box component="span" sx={{ color: '#f7931a' }}>◆</Box> Coin Tracker
          </Typography>
          <Stack direction="row" sx={{ display: { xs: 'none', md: 'flex' }, flexGrow: 1 }}>
            {NAV.map(n => (
              <Button key={n.to} component={NavLink} to={n.to} end={n.to === '/'} color="inherit"
                sx={{ fontSize: 13, color: '#aeb7c4', '&.active': { color: '#fff', fontWeight: 700 } }}>
                {t(n.key)}
              </Button>
            ))}
          </Stack>
          <Box sx={{ flexGrow: { xs: 1, md: 0 } }} />
          <Box sx={{ display: { xs: 'none', md: 'block' } }}><MarketSearch /></Box>
          <LangToggle />
        </Toolbar>
      </Container>

      <Drawer open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 260, p: 2 }}>
          <MarketSearch />
          <List>
            {NAV.map(n => (
              <ListItemButton key={n.to} component={NavLink} to={n.to} onClick={() => setOpen(false)}>
                <ListItemText primary={t(n.key)} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
};

const Footer: React.FC = () => {
  const { t } = useI18n();
  const col = (title: string, links: { to: string; label: string }[]) => (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
      <Stack spacing={0.5}>
        {links.map(l => (
          <Link key={l.to + l.label} component={RouterLink} to={l.to} color="text.secondary" underline="hover" fontSize={13}>{l.label}</Link>
        ))}
      </Stack>
    </Box>
  );

  return (
    <Box component="footer" sx={{ borderTop: '1px solid #1d2430', mt: 4, py: 4, bgcolor: '#0b0e14' }}>
      <Container maxWidth="xl">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={6}>
          <Box sx={{ maxWidth: 320 }}>
            <Typography sx={{ fontWeight: 800 }}><Box component="span" sx={{ color: '#f7931a' }}>◆</Box> Coin Tracker</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('footer.disclaimer')}</Typography>
          </Box>
          {col(t('footer.company'), [
            { to: '/about', label: t('nav.about') },
            { to: '/policy', label: t('nav.policy') },
            { to: '/about#contact', label: t('nav.contact') },
          ])}
          {col(t('footer.service'), [...NAV.slice(1), { to: '/live', key: 'nav.live' as TKey }].map(n => ({ to: n.to, label: t(n.key) })))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
          © {new Date().getFullYear()} Coin Tracker
        </Typography>
      </Container>
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

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <Header />
    <Container maxWidth="xl" component="main" sx={{ flexGrow: 1, py: 3 }}>{children}</Container>
    <Footer />
    <CookieBanner />
  </Box>
);

export default Layout;
