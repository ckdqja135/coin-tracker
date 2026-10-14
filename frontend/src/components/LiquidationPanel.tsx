import React, { useState } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { useI18n } from '../i18n';
import { fmtCompact } from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { LiqExchange, fetchLiquidations } from '../services/market';

const LONG = '#4dbf9a';
const SHORT = '#e06666';
const EXCHANGES: { id: LiqExchange; label: string; color: string }[] = [
  { id: 'binance', label: 'Binance', color: '#f0b90b' },
  { id: 'bybit', label: 'Bybit', color: '#f7a600' },
  { id: 'okx', label: 'OKX', color: '#3d6cf4' },
];
const WINDOWS = [
  { key: '1h', ms: 3600_000 },
  { key: '4h', ms: 4 * 3600_000 },
  { key: '12h', ms: 12 * 3600_000 },
  { key: '24h', ms: 24 * 3600_000 },
];

const ago = (now: number, t: number) => {
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** 롱/숏 비중 막대 */
const Bar: React.FC<{ long: number; short: number }> = ({ long, short }) => {
  const total = long + short;
  const lp = total ? (long / total) * 100 : 50;
  return (
    <Box sx={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', bgcolor: 'ui.chip.bg' }}>
      {total > 0 && <Box sx={{ width: `${lp}%`, bgcolor: LONG }} />}
      {total > 0 && <Box sx={{ width: `${100 - lp}%`, bgcolor: SHORT }} />}
    </Box>
  );
};

/** 거래소별 롱/숏 강제청산 합계와 최근 청산 목록 */
const LiquidationPanel: React.FC<{ coin: string }> = ({ coin }) => {
  const { t } = useI18n();
  const [win, setWin] = useState(WINDOWS[0]);
  const { data } = useAsync(() => fetchLiquidations(coin, 30), [coin], 5000);
  const now = data?.now ?? Date.now();

  const rows = EXCHANGES.map(ex => ({ ...ex, ...(data?.windows[win.key]?.[ex.id] ?? { long: 0, short: 0 }) }));
  const long = rows.reduce((a, r) => a + r.long, 0);
  const short = rows.reduce((a, r) => a + r.short, 0);
  // 서버가 아직 이 기간만큼 모으지 못했으면 몇 분째 모으는 중인지 알려준다
  const started = data ? Math.min(...EXCHANGES.map(ex => data.since[ex.id] ?? now)) : now;
  const collecting = now - started < win.ms ? Math.floor((now - started) / 60_000) : null;

  return (
    <Box sx={theme => ({ border: 1, borderColor: 'ui.card.border', borderRadius: `${theme.palette.ui.card.radius}px`, p: 2, mt: 3 })}>
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ pb: 1.5, borderBottom: 1, borderColor: 'ui.card.divider' }}>
        <Typography sx={{ fontSize: 17, fontWeight: 800 }}>{t('liq.title')}</Typography>
        <Tooltip title={t('liq.help')}><Box component="span" sx={{ color: 'text.secondary', cursor: 'help', fontSize: 13 }}>ⓘ</Box></Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        {WINDOWS.map(w => (
          <Button key={w.key} size="small" onClick={() => setWin(w)}
            sx={{ minWidth: 0, px: 1.2, py: 0.2, borderRadius: 99, fontSize: 12, fontWeight: 700, bgcolor: w.key === win.key ? 'primary.main' : 'ui.pill.bg', color: w.key === win.key ? '#fff' : 'ui.pill.fg', '&:hover': { bgcolor: w.key === win.key ? 'primary.dark' : 'ui.pill.hover' } }}>
            {w.key}
          </Button>
        ))}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 3, mt: 2 }}>
        {/* 합계 */}
        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
            <Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('liq.longs')}</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: LONG }}>${fmtCompact(long)}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('liq.total')}</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>${fmtCompact(long + short)}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('liq.shorts')}</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: SHORT }}>${fmtCompact(short)}</Typography>
            </Box>
          </Stack>
          <Bar long={long} short={short} />
          {collecting != null && (
            <Typography sx={{ fontSize: 10, color: 'text.secondary', textAlign: 'center', mt: 0.8 }}>{t('ls.collecting', { min: String(collecting) })}</Typography>
          )}
          <Stack spacing={1.2} sx={{ mt: 2 }}>
            {rows.map(r => (
              <Box key={r.id}>
                <Stack direction="row" alignItems="center" gap={0.8} sx={{ fontSize: 12, mb: 0.4 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: r.color }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, flexGrow: 1 }}>{r.label}</Typography>
                  <Typography sx={{ fontSize: 12, color: LONG, fontVariantNumeric: 'tabular-nums' }}>${fmtCompact(r.long)}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>/</Typography>
                  <Typography sx={{ fontSize: 12, color: SHORT, fontVariantNumeric: 'tabular-nums' }}>${fmtCompact(r.short)}</Typography>
                </Stack>
                <Bar long={r.long} short={r.short} />
              </Box>
            ))}
          </Stack>
        </Box>

        {/* 최근 청산 */}
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>{t('liq.recent')}</Typography>
          {data && data.recent.length === 0 && (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4, fontSize: 13 }}>{t('liq.empty')}</Typography>
          )}
          {data?.recent.slice(0, 12).map((l, i) => (
            <Stack key={`${l.exchange}-${l.time}-${i}`} direction="row" alignItems="center" gap={1} sx={{ py: 0.6, fontSize: 12, borderBottom: 1, borderColor: 'ui.card.divider' }}>
              <Box sx={{ width: 64, fontWeight: 700, color: l.side === 'long' ? LONG : SHORT }}>{l.side === 'long' ? t('liq.long') : t('liq.short')}</Box>
              <Typography sx={{ width: 64, fontSize: 12, color: 'text.secondary' }} noWrap>{EXCHANGES.find(e => e.id === l.exchange)?.label}</Typography>
              <Typography sx={{ flex: 1, fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>$ {l.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Typography>
              <Typography sx={{ width: 70, fontSize: 12, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${fmtCompact(l.usd)}</Typography>
              <Typography sx={{ width: 52, fontSize: 11, color: 'text.secondary', textAlign: 'right' }}>{ago(now, l.time)}</Typography>
            </Stack>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default LiquidationPanel;
