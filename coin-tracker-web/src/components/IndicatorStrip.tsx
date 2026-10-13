import React from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { TKey, useI18n } from '../i18n';
import { useAsync } from '../lib/useAsync';
import { DOWN, UP } from '../lib/vsRef';
import { fetchIndicators } from '../services/market';

const signed = (v: number, digits = 2) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;

const Item: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <Tooltip title={help ?? ''} disableHoverListener={!help}>
    <Stack direction="row" alignItems="baseline" gap={0.8} sx={{ cursor: help ? 'help' : undefined, whiteSpace: 'nowrap' }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{children}</Typography>
    </Stack>
  </Tooltip>
);

/** 홈 상단: 원/달러 환율 · 테더 가격과 테더 김프 · 공포탐욕 지수 */
const IndicatorStrip: React.FC = () => {
  const { t } = useI18n();
  const { data } = useAsync(fetchIndicators, [], 10_000);
  if (!data) return null;
  const { usdKrw, usdtKrw, usdtPremium, fng } = data;
  // 모르는 분류명이 오면 번역 키 대신 원문을 보여준다
  const fngKey = `fng.${fng?.label}` as TKey;
  const fngText = fng ? (t(fngKey) === fngKey ? fng.label : t(fngKey)) : '';
  const fngColor = fng == null ? undefined : fng.value >= 55 ? UP : fng.value <= 45 ? DOWN : undefined;

  return (
    <Stack direction="row" flexWrap="wrap" justifyContent="center" columnGap={3} rowGap={1}
      sx={{ py: 1, px: 2, borderRadius: 99, bgcolor: 'ui.pill.bg', width: 'fit-content', maxWidth: '100%', mx: 'auto' }}>
      {usdKrw != null && (
        <Item label={t('ind.usdKrw')}>₩ {usdKrw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Item>
      )}
      {usdtKrw != null && (
        <Item label={t('ind.usdt')} help={t('ind.usdtHelp')}>
          ₩ {usdtKrw.toLocaleString('en-US')}
          {usdtPremium != null && (
            <Box component="span" sx={{ ml: 0.8, color: usdtPremium > 0 ? UP : usdtPremium < 0 ? DOWN : undefined }}>
              {t('ind.usdtPremium')} {signed(usdtPremium)}
            </Box>
          )}
        </Item>
      )}
      {fng && (
        <Item label={t('ind.fng')} help={t('ind.fngHelp')}>
          <Box component="span" sx={{ color: fngColor }}>{fng.value} {fngText}</Box>
          {fng.prev != null && (
            <Box component="span" sx={{ ml: 0.8, fontSize: 11, fontWeight: 400, color: 'text.secondary' }}>{t('ind.yesterday', { v: String(fng.prev) })}</Box>
          )}
        </Item>
      )}
    </Stack>
  );
};

export default IndicatorStrip;
