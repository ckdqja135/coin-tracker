import React from 'react';
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
import Dashboard from './pages/Dashboard';
import { About, Blog, BlogPost, Policy } from './pages/Static';

// Create theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4fc3f7',
    },
    secondary: {
      main: '#f7931a',
    },
    background: {
      default: '#0b0e14',
      paper: '#11161f',
    },
    divider: '#1d2430',
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    button: { textTransform: 'none' },
  },
  components: {
    MuiPaper: { styleOverrides: { outlined: { borderColor: '#1d2430' } } },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nProvider>
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
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/about" element={<About />} />
              <Route path="/policy" element={<Policy />} />
              {/* 기존 소켓 기반 실시간 대시보드 (MariaDB 필요) */}
              <Route path="/live" element={<Dashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </Router>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
