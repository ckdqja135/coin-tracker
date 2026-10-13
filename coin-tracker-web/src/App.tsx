import React, { useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
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
import Notices from './pages/Notices';
import { About, Blog, BlogPost, Policy } from './pages/Static';
import { SelectedCoinsProvider } from './lib/selectedCoins';
import { ThemeMode, ThemeModeContext } from './lib/themeMode';
import { buildTheme } from './theme';
import { storage } from './lib/chartUtils';

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
              <Route path="/notices" element={<Notices />} />
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
