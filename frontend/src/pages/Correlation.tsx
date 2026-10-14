import React, { useMemo, useState } from 'react';
import { Box, CircularProgress, Stack, Tooltip, Typography } from '@mui/material';
import { useI18n } from '../i18n';
import { findAsset } from '../lib/assets';
import { INTERVAL_MS, correlation } from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { Candle, Interval, fetchKlines } from '../services/market';

type Tf = '1D' | '1W' | '1M' | '1Y';
const TFS: Tf[] = ['1D', '1W', '1M', '1Y'];
const TF_CONF: Record<Tf, { interval: Interval; limit: number }> = {
  '1D': { interval: '5m', limit: 288 },
  '1W': { interval: '1h', limit: 168 },
  '1M': { interval: '4h', limit: 180 },
  '1Y': { interval: '1d', limit: 365 },
};

const UNIVERSE = [
  { id: 'BTC', name: 'Bitcoin' },
  { id: 'NDX', name: 'Nasdaq' },
  { id: 'GOLD', name: 'Gold' },
  { id: 'ETH', name: 'Ethereum' },
  { id: 'DXY', name: 'US Dollar Index' },
];

const UP = '#5fbfab';
const DOWN = '#e57373';

/** 거래 시간이 다른 자산을 같은 버킷 시각에 맞춘다 (일봉은 UTC 날짜 기준) */
const align = (candles: Candle[], interval: Interval) => {
  const step = INTERVAL_MS[interval];
  const map = new Map<number, Candle>();
  candles.forEach(k => {
    const t = Math.floor(k.t / step) * step;
    map.set(t, { ...k, t });
  });
  return Array.from(map.values());
};

const useUniverse = (tf: Tf) => useAsync(async () => {
  const { interval, limit } = TF_CONF[tf];
  const settled = await Promise.allSettled(UNIVERSE.map(u => {
    const a = findAsset(u.id)!;
    return fetchKlines(a.source, a.symbol, interval, limit);
  }));
  const out: Record<string, Candle[]> = {};
  UNIVERSE.forEach((u, i) => {
    const r = settled[i];
    out[u.id] = r.status === 'fulfilled' ? align(r.value, interval) : [];
  });
  return out;
}, [tf], 300_000);

/** 연한 파스텔 색: +1 청록 ~ 0 회색 ~ -1 빨강 */
const cellColor = (r: number | null) => {
  if (r == null) return 'surface.empty';
  const a = Math.min(1, Math.abs(r));
  return r >= 0 ? `rgba(95,191,171,${0.15 + a * 0.85})` : `rgba(229,115,115,${0.15 + a * 0.85})`;
};

const TfChips: React.FC<{ value: Tf; onChange: (t: Tf) => void }> = ({ value, onChange }) => (
  <Stack direction="row" gap={0.5}>
    {TFS.map(tf => (
      <Box key={tf} component="button" onClick={() => onChange(tf)}
        sx={{
          width: 26, height: 26, borderRadius: '50%', border: 0, cursor: 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'inherit',
          bgcolor: tf === value ? 'ui.chip.activeBg' : 'ui.chip.bg', color: tf === value ? 'ui.chip.activeFg' : 'ui.chip.fg',
        }}>{tf}</Box>
    ))}
  </Stack>
);

const Panel: React.FC<{ title: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, actions, children }) => (
  <Box sx={theme => ({
    border: 1, borderColor: 'ui.card.border', borderRadius: `${theme.palette.ui.card.radius}px`, p: 2,
    bgcolor: 'ui.card.bg', boxShadow: theme.palette.mode === 'dark' ? 'none' : '0 1px 3px rgba(0,27,55,0.06)',
  })}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 800, flexGrow: 1 }}>{title}</Typography>
      {actions}
    </Stack>
    {children}
  </Box>
);

const Loading = () => <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={26} /></Box>;

const VsBars: React.FC<{ baseId: string; title: string }> = ({ baseId, title }) => {
  const [tf, setTf] = useState<Tf>('1D');
  const { data, loading } = useUniverse(tf);
  const rows = useMemo(() => (data
    ? UNIVERSE.filter(u => u.id !== baseId).map(u => ({ ...u, r: correlation(data[baseId] ?? [], data[u.id] ?? []).r }))
    : []), [data, baseId]);

  return (
    <Panel title={title} actions={<TfChips value={tf} onChange={setTf} />}>
      {loading && !data ? <Loading /> : (
        <Box sx={{ position: 'relative', pt: 1 }}>
          {/* -1 / 0 / +1 눈금 */}
          <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 9, color: 'text.secondary', px: 0.5, borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <span>-1</span><span>0</span><span>1</span>
          </Stack>
          <Box sx={{ position: 'absolute', left: '50%', top: 18, bottom: 0, width: '1px', bgcolor: 'divider' }} />
          {rows.map(r => {
            // 막대가 글씨를 담을 만큼 길면 막대 안쪽 시작 부분에 흰 글씨로,
            // 짧으면 막대 바로 바깥쪽(양수는 오른쪽, 음수는 왼쪽)에 회색 글씨로 쓴다
            const v = r.r;
            const inside = v != null && Math.abs(v) >= 0.25;
            const textLeft = v == null
              ? '50%'
              : inside
                ? (v > 0 ? 'calc(50% + 10px)' : `calc(${50 + v * 50}% + 10px)`)
                : (v >= 0 ? `calc(${50 + v * 50}% + 6px)` : `calc(${50 + v * 50}% - 6px)`);
            const textShift = v == null ? 'translateX(-50%)' : !inside && v < 0 ? 'translateX(-100%)' : undefined;
            return (
              <Box key={r.id} sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>{r.name}</Typography>
                <Box sx={{ position: 'relative', height: 28, bgcolor: 'surface.track', borderRadius: 99 }}>
                  {v != null && Math.abs(v) > 0.005 && (
                    <Box sx={{
                      position: 'absolute', top: 0, bottom: 0, bgcolor: v >= 0 ? UP : DOWN,
                      left: v >= 0 ? '50%' : `${50 + v * 50}%`, width: `${Math.abs(v) * 50}%`,
                      borderRadius: v >= 0 ? '0 99px 99px 0' : '99px 0 0 99px',
                    }} />
                  )}
                  <Typography sx={{
                    position: 'absolute', top: 0, fontSize: 12, fontWeight: 700, lineHeight: '28px', fontVariantNumeric: 'tabular-nums',
                    color: inside ? '#fff' : 'text.secondary', left: textLeft,
                    transform: textShift,
                  }}>
                    {v == null ? 'N/A' : v.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Panel>
  );
};

const LEGEND_STOPS = [1, 0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75, -1];

const Heatmap: React.FC = () => {
  const { t } = useI18n();
  const [tf, setTf] = useState<Tf>('1D');
  const { data, loading } = useUniverse(tf);
  const matrix = useMemo(() => (data
    ? UNIVERSE.map(a => UNIVERSE.map(b => correlation(data[a.id] ?? [], data[b.id] ?? []).r))
    : null), [data]);
  const n = UNIVERSE.length;

  return (
    <Panel title={t('corr.heatmap')} actions={<TfChips value={tf} onChange={setTf} />}>
      {loading && !matrix ? <Loading /> : matrix && (
        <Stack direction="row" gap={4} sx={{ overflowX: 'auto', py: 1 }}>
          <Box sx={{ flexGrow: 1, minWidth: 560 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: `110px repeat(${n}, 1fr)`, gap: 1, position: 'relative' }}>
              {/* 왼쪽·아래 축선 */}
              <Box sx={{ position: 'absolute', left: 113, top: 0, height: n * 66 + (n - 1) * 8 + 4, width: '1px', bgcolor: 'divider' }} />
              <Box sx={{ position: 'absolute', left: 113, right: 0, top: n * 66 + (n - 1) * 8 + 4, height: '1px', bgcolor: 'divider' }} />
              {UNIVERSE.map((row, i) => (
                <React.Fragment key={row.id}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, alignSelf: 'center', textAlign: 'right', pr: 1 }}>{row.name}</Typography>
                  {UNIVERSE.map((col, j) => {
                    if (j > i) return <Box key={col.id} />;
                    if (i === j) {
                      return <Box key={col.id} sx={{ bgcolor: 'surface.empty', height: 66, borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b0b6c0' }}>·</Box>;
                    }
                    const r = matrix[i][j];
                    return (
                      <Tooltip key={col.id} title={`${row.name} × ${col.name}`}>
                        <Box sx={{
                          bgcolor: cellColor(r), height: 66, borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, color: r != null && Math.abs(r) > 0.6 ? '#fff' : 'text.primary', fontVariantNumeric: 'tabular-nums',
                        }}>
                          {r == null ? 'N/A' : r.toFixed(2)}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </React.Fragment>
              ))}
              <Box />
              {UNIVERSE.map(c => (
                <Typography key={c.id} sx={{ fontSize: 12, fontWeight: 700, transform: 'rotate(-40deg)', transformOrigin: 'center', textAlign: 'center', whiteSpace: 'nowrap', mt: 3, mb: 3 }}>
                  {c.name}
                </Typography>
              ))}
            </Box>
          </Box>
          {/* 색상 범례 */}
          <Stack sx={{ pt: 0.5 }}>
            {LEGEND_STOPS.map((v, idx) => (
              <Stack key={v} direction="row" alignItems="flex-start" gap={1} sx={{ height: 44 }}>
                <Box sx={{ width: 4, height: idx === LEGEND_STOPS.length - 1 ? 2 : 44, bgcolor: cellColor(v === 0 ? 0.01 : v - Math.sign(v) * 0.125) }} />
                <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: -0.8 }}>{v.toFixed(2)}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </Panel>
  );
};

const Correlation: React.FC = () => {
  const { t } = useI18n();
  return (
    <Box>
      <Typography sx={{ fontSize: 24, fontWeight: 800, mb: 1 }}>{t('corr.coef')}</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3, maxWidth: 900 }}>{t('corr.intro')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        <VsBars baseId="BTC" title={t('corr.vs', { asset: 'Bitcoin' })} />
        <VsBars baseId="ETH" title={t('corr.vs', { asset: 'Ethereum' })} />
      </Box>
      <Heatmap />
    </Box>
  );
};

export default Correlation;
