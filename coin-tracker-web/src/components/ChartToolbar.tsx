import React from 'react';
import { Box, Button, ButtonGroup, MenuItem, Select, Stack, Tooltip, IconButton } from '@mui/material';
import { useI18n } from '../i18n';
import { Interval } from '../services/market';
import { RangeKey, RANGES, intervalsForRange } from '../lib/chartUtils';

export type Scale = 'linear' | 'log' | 'percent';
export const MA_OPTIONS = [0, 7, 14, 30, 50, 90];

interface Props {
  range: RangeKey;
  interval: Interval;
  onRangeChange: (r: RangeKey) => void;
  onIntervalChange: (i: Interval) => void;
  ma?: number;
  onMaChange?: (n: number) => void;
  scale?: Scale;
  scales?: Scale[];
  onScaleChange?: (s: Scale) => void;
  onCsv?: () => void;
  onCapture?: () => void;
  onCopyLink?: () => void;
  children?: React.ReactNode;
}

const small = { size: 'small' as const, sx: { minWidth: 0, px: 1.2, fontSize: 12 } };

const ChartToolbar: React.FC<Props> = ({
  range, interval, onRangeChange, onIntervalChange, ma, onMaChange, scale, scales = ['linear', 'log'], onScaleChange,
  onCsv, onCapture, onCopyLink, children,
}) => {
  const { t } = useI18n();
  const scaleLabel: Record<Scale, string> = { linear: t('common.linear'), log: t('common.log'), percent: t('common.percent') };

  return (
    <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} sx={{ mb: 1 }}>
      <ButtonGroup variant="outlined" color="inherit">
        {RANGES.map(r => (
          <Button key={r} {...small} variant={r === range ? 'contained' : 'outlined'} color={r === range ? 'primary' : 'inherit'}
            onClick={() => onRangeChange(r)}>{r}</Button>
        ))}
      </ButtonGroup>

      <Tooltip title={t('common.interval')}>
        <Select size="small" value={interval} onChange={e => onIntervalChange(e.target.value as Interval)} sx={{ fontSize: 12, height: 31 }}>
          {intervalsForRange(range).map(i => <MenuItem key={i} value={i}>{i}</MenuItem>)}
        </Select>
      </Tooltip>

      {onMaChange && (
        <Tooltip title={t('common.ma')}>
          <Select size="small" value={ma ?? 0} onChange={e => onMaChange(Number(e.target.value))} sx={{ fontSize: 12, height: 31 }}
            renderValue={v => `MA ${v === 0 ? t('common.none') : v}`}>
            {MA_OPTIONS.map(n => <MenuItem key={n} value={n}>{n === 0 ? t('common.none') : `MA ${n}`}</MenuItem>)}
          </Select>
        </Tooltip>
      )}

      {onScaleChange && scale && (
        <ButtonGroup variant="outlined" color="inherit">
          {scales.map(s => (
            <Button key={s} {...small} variant={s === scale ? 'contained' : 'outlined'} color={s === scale ? 'primary' : 'inherit'}
              onClick={() => onScaleChange(s)}>{scaleLabel[s]}</Button>
          ))}
        </ButtonGroup>
      )}

      {children}

      <Box sx={{ flexGrow: 1 }} />

      {onCopyLink && <Button {...small} color="inherit" onClick={onCopyLink}>🔗 {t('common.copyLink')}</Button>}
      {onCsv && <Button {...small} color="inherit" onClick={onCsv}>⬇ {t('common.csv')}</Button>}
      {onCapture && (
        <Tooltip title={t('common.capture')}>
          <IconButton size="small" onClick={onCapture}>📷</IconButton>
        </Tooltip>
      )}
    </Stack>
  );
};

export default ChartToolbar;
