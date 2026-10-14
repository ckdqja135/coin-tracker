import { createTheme } from '@mui/material/styles';
import type { UiTokens } from './theme.d';
import { ThemeMode } from './lib/themeMode';

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
export const buildTheme = (mode: ThemeMode) => createTheme({
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
