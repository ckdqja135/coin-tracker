import React, { useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { I18nProvider } from './i18n';
import Layout from './components/Layout';
import Home from './pages/Home';
import CoinPage from './pages/CoinPage';
import Markets from './pages/Markets';
import CompareVs from './pages/CompareVs';
import LongShort from './pages/LongShort';
import Correlation from './pages/Correlation';
import Calendar from './pages/Calendar';
import { About, Blog, BlogPost, Policy } from './pages/Static';
import { SelectedCoinsProvider } from './lib/selectedCoins';
import { ThemeMode, ThemeModeContext } from './lib/themeMode';
import { storage } from './lib/chartUtils';
import type { UiTokens } from './theme.d';

// 라이트: 토스풍 (흰 배경, 연회색 표면, 파란 포인트) / 다크: 어두운 톤
const LIGHT_UI: UiTokens = {
  header: { bg: '#ffffff', fg: '#333d4b', muted: '#6b7684', active: '#3182f6', border: '#e5e8eb' },
  ticker: { bg: '#f9fafb', fg: '#191f28', muted: '#6b7684', border: '#e5e8eb' },
  sidebar: {
    bg: '#ffffff', fg: '#4e5968', muted: '#8b95a1', title: '#191f28', group: '#3182f6', border: '#e5e8eb',
    activeBg: '#e8f3ff', activeFg: '#1b64da', inputBorder: '#d1d6db', badgeBg: '#e8f3ff', badgeFg: '#3182f6',
  },
  card: { bg: '#ffffff', fg: '#191f28', muted: '#8b95a1', border: '#e5e8eb', divider: '#f2f4f6', iconBorder: '#e5e8eb', radius: 16 },
  chip: { bg: '#f2f4f6', fg: '#6b7684', activeBg: '#3182f6', activeFg: '#ffffff', hover: '#e5e8eb' },
  pill: { bg: '#f2f4f6', fg: '#333d4b', hover: '#e5e8eb' },
  highlight: { bg: '#e8f3ff', fg: '#1b64da' },
  footer: { bg: '#f9fafb', fg: '#4e5968', muted: '#8b95a1', title: '#191f28', border: '#e5e8eb' },
};

const DARK_UI: UiTokens = {
  header: { bg: '#2a2d33', fg: '#ffffff', muted: '#aeb7c4', active: '#7fa4ff', border: '#2a2d33' },
  ticker: { bg: '#16191f', fg: '#e6ebf2', muted: '#e6ebf2', border: '#262b33' },
  sidebar: {
    bg: '#16171a', fg: '#9aa1ad', muted: '#5b6070', title: '#ffffff', group: '#4f86ff', border: '#2a2c31',
    activeBg: 'transparent', activeFg: '#ffffff', inputBorder: '#3a3d44', badgeBg: '#23262d', badgeFg: '#6f9cff',
  },
  card: { bg: '#1b1c1f', fg: '#ffffff', muted: '#9aa1ad', border: '#2a2c31', divider: '#2a2c31', iconBorder: '#3a3d44', radius: 8 },
  chip: { bg: '#2c2e33', fg: '#9aa1ad', activeBg: '#6b6f76', activeFg: '#ffffff', hover: '#45484f' },
  pill: { bg: '#2e333d', fg: '#ffffff', hover: '#3a404b' },
  highlight: { bg: '#2e333d', fg: '#ffffff' },
  footer: { bg: '#2a2d33', fg: '#e6e8ec', muted: '#9aa1ad', title: '#9aa6c4', border: '#3a3d44' },
};

// Create theme
const buildTheme = (mode: ThemeMode) => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'dark' ? '#3d6cf4' : '#3182f6',
    },
    secondary: {
      main: '#f7931a',
    },
    // undefined를 넘기면 MUI 기본값이 지워지므로 라이트 모드일 때만 덮어쓴다
    ...(mode === 'light' ? { text: { primary: '#191f28', secondary: '#6b7684', disabled: '#b0b8c1' }, divider: '#e5e8eb' } : {}),
    background: mode === 'dark'
      ? { default: '#16191f', paper: '#1d2027' }
      : { default: '#ffffff', paper: '#ffffff' },
    surface: mode === 'dark'
      ? { inverse: '#2e333d', inverseHover: '#3a404b', track: '#2a2e36', empty: '#252930', chartBg: '#22252b' }
      : { inverse: '#f2f4f6', inverseHover: '#e5e8eb', track: '#f2f4f6', empty: '#f2f4f6', chartBg: '#ffffff' },
    ui: mode === 'dark' ? DARK_UI : LIGHT_UI,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    button: { textTransform: 'none' },
  },
});

function App() {
  const [mode, setMode] = useState<ThemeMode>(() => storage.get<ThemeMode>('themeMode', 'light'));
  const theme = useMemo(() => buildTheme(mode), [mode]);
  const themeMode = useMemo(() => ({
    mode,
    toggle: () => setMode(m => {
      const next = m === 'dark' ? 'light' : 'dark';
      storage.set('themeMode', next);
      return next;
    }),
  }), [mode]);

  return (
    <ThemeModeContext.Provider value={themeMode}>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nProvider>
        <SelectedCoinsProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/compare" element={<CompareVs />} />
              <Route path="/btc" element={<CoinPage key="BTC" coin="BTC" />} />
              <Route path="/eth" element={<CoinPage key="ETH" coin="ETH" />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/longs-shorts" element={<LongShort />} />
              <Route path="/correlation" element={<Correlation />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/about" element={<About />} />
              <Route path="/policy" element={<Policy />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </Router>
        </SelectedCoinsProvider>
      </I18nProvider>
    </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export default App;
