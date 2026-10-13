import React from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { TKey, useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { DOWN, UP } from '../lib/vsRef';
import { fetchIndicators } from '../services/market';

const signed = (v: number, digits = 2) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;

const Sep = () => <Box component="span" sx={{ color: 'ui.ticker.border', mx: 1.5 }}>|</Box>;

const Item: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <Tooltip title={help ?? ''} disableHoverListener={!help}>
    <Stack component="span" direction="row" alignItems="baseline" gap={1} sx={{ cursor: help ? 'help' : undefined, whiteSpace: 'nowrap' }}>
      <span>{label}</span>
      <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, color: 'ui.ticker.fg', fontVariantNumeric: 'tabular-nums' }}>{children}</Typography>
    </Stack>
  </Tooltip>
);

/** 헤더 아래 바 오른쪽: 원/달러 환율 · 테더 가격과 테더 김프 · 공포탐욕 지수 */
const IndicatorStrip: React.FC = () => {
  const { t } = useI18n();
  const { data } = useAsync(fetchIndicators, [], 10_000);
  if (!data) return null;
  const { usdKrw, usdtKrw, usdtPremium, fng } = data;
  // 모르는 분류명이 오면 번역 키 대신 원문을 보여준다
  const fngKey = `fng.${fng?.label}` as TKey;
  const fngText = fng ? (t(fngKey) === fngKey ? fng.label : t(fngKey)) : '';
  const fngColor = fng == null ? undefined : fng.value >= 55 ? UP : fng.value <= 45 ? DOWN : undefined;
  const fngHelp = fng?.prev != null ? `${t('ind.fngHelp')} (${t('ind.yesterday', { v: String(fng.prev) })})` : t('ind.fngHelp');

  return (
    <Stack component="span" direction="row" alignItems="center">
      {usdKrw != null && (
        <Item label={t('ind.usdKrw')}>₩ {usdKrw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Item>
      )}
      {usdtKrw != null && (
        <>
          <Sep />
          <Item label={t('ind.usdt')} help={t('ind.usdtHelp')}>
            ₩ {usdtKrw.toLocaleString('en-US')}
            {usdtPremium != null && (
              <Box component="span" sx={{ ml: 0.8, color: usdtPremium > 0 ? UP : usdtPremium < 0 ? DOWN : undefined }}>{signed(usdtPremium)}</Box>
            )}
          </Item>
        </>
      )}
      {fng && (
        <>
          <Sep />
          <Item label={t('ind.fng')} help={fngHelp}>
            <Box component="span" sx={{ color: fngColor }}>{fng.value} {fngText}</Box>
          </Item>
        </>
      )}
    </Stack>
  );
};

export default IndicatorStrip;
