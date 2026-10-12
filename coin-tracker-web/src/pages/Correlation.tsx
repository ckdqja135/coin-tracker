import React, { useMemo, useState } from 'react';
import {
  Box, Button, ButtonGroup, CircularProgress, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { PageHeader, Panel } from '../components/Panel';
import { useI18n } from '../i18n';
import { Asset, findAsset } from '../lib/assets';
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

const UNIVERSE = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'SPX', 'NDX', 'GOLD', 'DXY', 'OIL', 'USDKRW']
  .map(id => findAsset(id)!)
  .filter(Boolean);

/** 거래 시간이 다른 자산을 같은 버킷 시각에 맞춘다 */
const align = (candles: Candle[], interval: Interval) => {
  const step = INTERVAL_MS[interval];
  const map = new Map<number, Candle>();
  candles.forEach(k => map.set(Math.floor(k.t / step) * step, { ...k, t: Math.floor(k.t / step) * step }));
  return Array.from(map.values());
};

const useUniverse = (tf: Tf) => useAsync(async () => {
  const { interval, limit } = TF_CONF[tf];
  const settled = await Promise.allSettled(UNIVERSE.map(a => fetchKlines(a.source, a.symbol, interval, limit)));
  const out: Record<string, Candle[]> = {};
  UNIVERSE.forEach((a, i) => {
    const r = settled[i];
    out[a.id] = r.status === 'fulfilled' ? align(r.value, interval) : [];
  });
  return out;
}, [tf], 300_000);

/** -1(빨강) ~ 0(회색) ~ +1(초록) */
const corrColor = (r: number | null) => {
  if (r == null) return '#1d2430';
  const a = Math.min(1, Math.abs(r));
  return r >= 0 ? `rgba(38,166,154,${0.15 + a * 0.75})` : `rgba(239,83,80,${0.15 + a * 0.75})`;
};

const TfButtons: React.FC<{ value: Tf; onChange: (t: Tf) => void }> = ({ value, onChange }) => (
  <ButtonGroup size="small" color="inherit">
    {TFS.map(tf => (
      <Button key={tf} variant={tf === value ? 'contained' : 'outlined'} color={tf === value ? 'primary' : 'inherit'}
        onClick={() => onChange(tf)} sx={{ minWidth: 0, px: 1.2, fontSize: 12 }}>{tf}</Button>
    ))}
  </ButtonGroup>
);

const Loading = () => <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={28} /></Box>;

const VsList: React.FC<{ base: Asset; onBaseChange?: (id: string) => void; title: string }> = ({ base, onBaseChange, title }) => {
  const [tf, setTf] = useState<Tf>('1M');
  const { data, loading } = useUniverse(tf);

  const rows = useMemo(() => {
    if (!data) return [];
    return UNIVERSE.filter(a => a.id !== base.id)
      .map(a => ({ asset: a, ...correlation(data[base.id] ?? [], data[a.id] ?? []) }))
      .sort((x, y) => (y.r ?? -2) - (x.r ?? -2));
  }, [data, base.id]);

  return (
    <Panel
      title={title}
      actions={
        <Stack direction="row" gap={1} alignItems="center">
          {onBaseChange && (
            <TextField select size="small" value={base.id} onChange={e => onBaseChange(e.target.value)} sx={{ minWidth: 140 }}>
              {UNIVERSE.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
            </TextField>
          )}
          <TfButtons value={tf} onChange={setTf} />
        </Stack>
      }
    >
      {loading && !data ? <Loading /> : (
        <Stack spacing={0.8}>
          {rows.map(r => (
            <Stack key={r.asset.id} direction="row" alignItems="center" gap={1.5}>
              <Typography sx={{ width: 120, fontSize: 13, fontWeight: 600 }} noWrap>{r.asset.name}</Typography>
              <Box sx={{ flexGrow: 1, height: 18, position: 'relative', bgcolor: '#141a24', borderRadius: 1 }}>
                <Box sx={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', bgcolor: '#3a4556' }} />
                {r.r != null && (
                  <Box sx={{
                    position: 'absolute', top: 2, bottom: 2, borderRadius: 0.5, bgcolor: corrColor(r.r),
                    left: r.r >= 0 ? '50%' : `${50 + r.r * 50}%`, width: `${Math.abs(r.r) * 50}%`,
                  }} />
                )}
              </Box>
              <Tooltip title={`n = ${r.n}`}>
                <Typography sx={{ width: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700 }}>
                  {r.r == null ? 'N/A' : r.r.toFixed(2)}
                </Typography>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      )}
    </Panel>
  );
};

const Heatmap: React.FC = () => {
  const { t } = useI18n();
  const [tf, setTf] = useState<Tf>('1M');
  const { data, loading } = useUniverse(tf);

  const matrix = useMemo(() => {
    if (!data) return null;
    return UNIVERSE.map(a => UNIVERSE.map(b => (a.id === b.id ? 1 : correlation(data[a.id] ?? [], data[b.id] ?? []).r)));
  }, [data]);

  const n = UNIVERSE.length;
  return (
    <Panel title={t('corr.heatmap')} subtitle={t('corr.note')} actions={<TfButtons value={tf} onChange={setTf} />}>
      {loading && !matrix ? <Loading /> : matrix && (
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: `80px repeat(${n}, minmax(44px, 1fr))`, gap: '2px', minWidth: 80 + n * 46, maxWidth: 80 + n * 64 }}>
            {UNIVERSE.map((row, i) => (
              <React.Fragment key={row.id}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, alignSelf: 'center' }} noWrap>{row.short}</Typography>
                {UNIVERSE.map((col, j) => {
                  // 하삼각 + 대각선만 표시
                  if (j > i) return <Box key={col.id} />;
                  const r = matrix[i][j];
                  return (
                    <Tooltip key={col.id} title={`${row.name} × ${col.name}`}>
                      <Box sx={{
                        bgcolor: corrColor(r), aspectRatio: '1.4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, borderRadius: 0.5, fontVariantNumeric: 'tabular-nums',
                      }}>
                        {r == null ? '–' : r.toFixed(2)}
                      </Box>
                    </Tooltip>
                  );
                })}
              </React.Fragment>
            ))}
            <Box />
            {UNIVERSE.map(c => (
              <Typography key={c.id} sx={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }} noWrap>{c.short}</Typography>
            ))}
          </Box>
        </Box>
      )}
    </Panel>
  );
};

const Correlation: React.FC = () => {
  const { t } = useI18n();
  const [vsBase, setVsBase] = useState('ETH');
  const btc = findAsset('BTC')!;
  const other = findAsset(vsBase)!;

  return (
    <>
      <PageHeader title={t('corr.title')} desc={t('corr.desc')} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 2 }}>
        <VsList base={btc} title={`${t('corr.coef')} · ${t('corr.vs', { asset: 'Bitcoin' })}`} />
        <VsList base={other} onBaseChange={setVsBase} title={t('corr.vs', { asset: other.name })} />
      </Box>
      <Heatmap />
    </>
  );
};

export default Correlation;
