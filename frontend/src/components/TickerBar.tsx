import React from 'react';
import { Box, Container, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useI18n } from '../i18n';
import { fmtCompact, fmtPrice } from '../lib/chartUtils';
import { useSelectedCoins } from '../lib/selectedCoins';
import { useAsync } from '../lib/useAsync';
import { fetchCoinInfo } from '../services/market';
import IndicatorStrip from './IndicatorStrip';

const Sep = () => <Box component="span" sx={{ color: 'ui.ticker.border', mx: 1.5 }}>|</Box>;

/** 헤더 아래 선택 코인 요약 바 (위/아래 버튼으로 코인 전환) + 오른쪽에 환율·테더 김프·공포탐욕 */
const TickerBar: React.FC = () => {
  const { t } = useI18n();
  const { coins, active, setActive } = useSelectedCoins();
  const list = coins.length ? coins : ['BTC'];
  const { data } = useAsync(() => fetchCoinInfo(list), [list.join(',')], 30_000);
  const info = data?.find(c => c.symbol === active) ?? data?.[0];

  const step = (d: number) => {
    const i = list.indexOf(info?.symbol ?? active);
    setActive(list[(i + d + list.length) % list.length]);
  };

  const chg = info?.change24h ?? null;
  const chgAbs = info && chg != null ? info.price - info.price / (1 + chg / 100) : null;
  const color = chg == null ? undefined : chg >= 0 ? '#26a69a' : '#ef5350';

  return (
    <Box sx={{ bgcolor: 'ui.ticker.bg', color: 'ui.ticker.muted', borderBottom: 1, borderColor: 'ui.ticker.border' }}>
      <Container maxWidth="lg">
        <Stack direction="row" alignItems="center" sx={{ height: 34, fontSize: 12, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {info?.image && <Box component="img" src={info.image} alt="" sx={{ width: 16, height: 16, mr: 1 }} />}
          <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, color: 'ui.ticker.fg' }}>{info ? `${info.name} (${info.symbol})` : active}</Typography>
          <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, ml: 1, color: 'ui.ticker.fg' }}>{fmtPrice(info?.price)}</Typography>
          <Sep />
          {/* 오른쪽 지표 자리를 위해 24h 최고·최저는 변동에 마우스를 올리면 보여준다 */}
          <Tooltip title={`${t('ticker.high')} ${fmtPrice(info?.high24h).replace('$', '')} · ${t('ticker.low')} ${fmtPrice(info?.low24h).replace('$', '')}`}>
            <Box component="span" sx={{ cursor: 'help' }}>
              <span>{t('ticker.change')}</span>
              <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, ml: 1, color }}>
                {chgAbs != null ? chgAbs.toLocaleString('en-US', { maximumSignificantDigits: Math.abs(chgAbs) >= 1 ? undefined : 3, maximumFractionDigits: Math.abs(chgAbs) >= 1 ? 2 : undefined }) : ''} {chg != null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : ''}
              </Typography>
            </Box>
          </Tooltip>
          <Sep />
          <span>{t('ticker.mcap')}</span>
          <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, ml: 1, color: 'ui.ticker.fg' }}>
            {info?.marketCap != null ? `$${fmtCompact(info.marketCap)}` : '-'}
          </Typography>
          <Box sx={{ flexGrow: 1, minWidth: 24 }} />
          {/* 원/달러 · 테더 김프 · 공포탐욕 (모든 페이지 공통) */}
          <IndicatorStrip />
          {list.length > 1 && (
            <Stack sx={{ ml: 1 }}>
              <IconButton size="small" sx={{ p: 0, color: 'ui.ticker.fg', fontSize: 9, lineHeight: 1 }} onClick={() => step(-1)} aria-label="prev">▲</IconButton>
              <IconButton size="small" sx={{ p: 0, color: 'ui.ticker.fg', fontSize: 9, lineHeight: 1 }} onClick={() => step(1)} aria-label="next">▼</IconButton>
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default TickerBar;
