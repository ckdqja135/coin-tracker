import React, { useMemo, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CoinIcon from '../components/CoinIcon';
import { TKey, useI18n } from '../i18n';
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
  { id: 'ETH', name: 'Ethereum' },
  { id: 'NDX', name: 'Nasdaq' },
  { id: 'GOLD', name: 'Gold' },
  { id: 'DXY', name: 'US Dollar Index' },
];

/** 양(같은 방향)·음(반대 방향) 상관 색 */
const usePalette = () => {
  const dark = useTheme().palette.mode === 'dark';
  return dark ? { pos: '#3fbf9f', neg: '#ee6a60', posRgb: '63,191,159', negRgb: '238,106,96' } : { pos: '#2f9e85', neg: '#d9554b', posRgb: '47,158,133', negRgb: '217,85,75' };
};

/** |r| 기준 강도: 0.7 강함 · 0.4 보통 · 0.2 약함 · 그 외 거의 무관 */
const level = (r: number) => {
  const a = Math.abs(r);
  return a >= 0.7 ? 'strong' : a >= 0.4 ? 'moderate' : a >= 0.2 ? 'weak' : null;
};
const useStrength = () => {
  const { t } = useI18n();
  return (r: number) => {
    const lv = level(r);
    return lv ? `${t(`corr.lv.${lv}` as TKey)} ${r > 0 ? t('corr.pos') : t('corr.neg')}` : t('corr.none');
  };
};
const signed = (r: number) => `${r > 0 ? '+' : ''}${r.toFixed(2)}`;

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

const Segmented: React.FC<{ value: Tf; onChange: (t: Tf) => void }> = ({ value, onChange }) => (
  <Stack direction="row" gap={0.25} sx={{ p: '3px', borderRadius: '9px', bgcolor: 'ui.pill.bg' }}>
    {TFS.map(tf => (
      <Box key={tf} component="button" type="button" onClick={() => onChange(tf)} aria-pressed={tf === value} sx={{
        height: 28, minWidth: 38, border: 0, borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
        bgcolor: tf === value ? 'background.paper' : 'transparent', color: tf === value ? 'text.primary' : 'text.secondary',
        boxShadow: tf === value ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
      }}>{tf}</Box>
    ))}
  </Stack>
);

const Card: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '18px', ...sx }}>{children}</Box>
);

const Loading = () => <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={26} /></Box>;

const BAR_COLS = { xs: '96px 1fr 92px', sm: '130px 1fr 112px' };

/** 기준 자산 대비 다른 자산들의 상관계수 막대 (높은 순) */
const VsCard: React.FC<{ baseId: string; name: string }> = ({ baseId, name }) => {
  const [tf, setTf] = useState<Tf>('1D');
  const { data, loading } = useUniverse(tf);
  const pal = usePalette();
  const strength = useStrength();
  const rows = useMemo(() => (data
    ? UNIVERSE.filter(u => u.id !== baseId)
      .map(u => ({ ...u, r: correlation(data[baseId] ?? [], data[u.id] ?? []).r }))
      .sort((a, b) => (b.r ?? -2) - (a.r ?? -2))
    : []), [data, baseId]);

  return (
    <Card sx={{ px: 3, pt: 2.75, pb: 2.25, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Stack direction="row" alignItems="center" gap={1.25}>
        <CoinIcon symbol={baseId} size={24} />
        <Typography sx={{ fontSize: 18, fontWeight: 800, flex: 1 }}>{name} VS</Typography>
        <Segmented value={tf} onChange={setTf} />
      </Stack>
      {loading && !data ? <Loading /> : (
        <Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: BAR_COLS, gap: 1.75, fontSize: 11.5, fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
            <span />
            <Stack direction="row" justifyContent="space-between"><span>-1</span><span>0</span><span>+1</span></Stack>
            <span />
          </Box>
          <Stack gap={0.75}>
            {rows.map(row => {
              const r = row.r;
              const color = r == null ? 'text.disabled' : r >= 0 ? pal.pos : pal.neg;
              const w = r == null ? 0 : Math.abs(r) * 50;
              return (
                <Box key={row.id} sx={{ display: 'grid', gridTemplateColumns: BAR_COLS, gap: 1.75, alignItems: 'center', height: 48 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700 }} noWrap>{row.name}</Typography>
                  <Box sx={{ position: 'relative', height: 14, borderRadius: '7px', bgcolor: 'ui.pill.bg' }}>
                    <Box sx={{ position: 'absolute', left: '50%', top: -6, bottom: -6, borderLeft: '1.5px solid', borderColor: 'text.secondary' }} />
                    {r != null && (
                      <Box sx={{
                        position: 'absolute', top: 0, bottom: 0, bgcolor: color, transition: 'all .35s',
                        left: r >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, borderRadius: r >= 0 ? '0 7px 7px 0' : '7px 0 0 7px',
                      }} />
                    )}
                  </Box>
                  <Stack alignItems="flex-end" gap="1px">
                    <Typography sx={{ fontSize: 17, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{r == null ? 'N/A' : signed(r)}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{r == null ? '' : strength(r)}</Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </Card>
  );
};

/** 아래 삼각 히트맵: 셀에 마우스를 올리면 오른쪽에 두 자산의 관계를 설명한다 */
const Heatmap: React.FC = () => {
  const { t } = useI18n();
  const pal = usePalette();
  const strength = useStrength();
  const [tf, setTf] = useState<Tf>('1D');
  const [hover, setHover] = useState<[number, number] | null>(null);
  const { data, loading } = useUniverse(tf);
  const matrix = useMemo(() => (data
    ? UNIVERSE.map(a => UNIVERSE.map(b => correlation(data[a.id] ?? [], data[b.id] ?? []).r))
    : null), [data]);
  const n = UNIVERSE.length;
  const rangeLabel = t(`corr.r.${tf}` as TKey);

  // 대각선을 뺀 쌍 중 |r|이 가장 큰 관계
  const top = useMemo(() => {
    if (!matrix) return null;
    let best: { i: number; j: number; r: number } | null = null;
    matrix.forEach((row, i) => row.forEach((r, j) => {
      if (j < i && r != null && (!best || Math.abs(r) > Math.abs(best.r))) best = { i, j, r };
    }));
    return best as { i: number; j: number; r: number } | null;
  }, [matrix]);

  const cellBg = (r: number) => `rgba(${r >= 0 ? pal.posRgb : pal.negRgb},${(0.1 + Math.min(1, Math.abs(r)) * 0.85).toFixed(2)})`;
  const hr = hover && matrix ? matrix[hover[0]][hover[1]] : null;
  const desc = (r: number) => {
    const lv = level(r);
    if (!lv) return t('corr.descNone');
    const key = `corr.desc${r > 0 ? 'Same' : 'Opp'}${lv === 'strong' ? 'Strong' : ''}` as TKey;
    return t(key, { label: strength(r) });
  };
  const on = (k: number) => !!hover && (hover[0] === k || hover[1] === k);

  return (
    <Card sx={{ px: 3, pt: 2.75, pb: 3.25, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5}>
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{t('corr.heatmap')}</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('corr.hoverHint')}</Typography>
        <Box sx={{ flex: 1 }} />
        <Segmented value={tf} onChange={v => { setTf(v); setHover(null); }} />
      </Stack>
      {loading && !matrix ? <Loading /> : matrix && (
        <Stack direction={{ xs: 'column', md: 'row' }} gap={5} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0, width: '100%', overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: `140px repeat(${n}, minmax(64px, 1fr))`, gap: 0.75, minWidth: 520 }}>
              <span />
              {UNIVERSE.map((c, j) => (
                <Typography key={c.id} sx={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 14, lineHeight: 1.2, fontWeight: on(j) ? 800 : 600, color: on(j) ? 'text.primary' : 'text.secondary' }}>{c.name}</Typography>
              ))}
              {UNIVERSE.map((row, i) => (
                <React.Fragment key={row.id}>
                  <Typography sx={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 1, fontSize: 14, fontWeight: on(i) ? 800 : 600, color: on(i) ? 'text.primary' : 'text.secondary' }}>{row.name}</Typography>
                  {UNIVERSE.map((col, j) => {
                    if (j > i) return <Box key={col.id} />;
                    const diag = i === j;
                    const r = matrix[i][j];
                    const active = !!hover && hover[0] === i && hover[1] === j;
                    return (
                      <Box key={col.id}
                        onMouseEnter={diag || r == null ? undefined : () => setHover([i, j])}
                        onMouseLeave={diag ? undefined : () => setHover(null)}
                        sx={{
                          height: 64, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15, fontWeight: diag ? 500 : 700, fontVariantNumeric: 'tabular-nums', transition: 'background .3s',
                          bgcolor: diag || r == null ? 'ui.pill.bg' : cellBg(r),
                          color: diag || r == null ? 'text.secondary' : Math.abs(r) >= 0.55 ? '#fff' : 'text.primary',
                          outline: active ? '2px solid' : 'none', outlineColor: 'text.primary', outlineOffset: '-2px',
                          cursor: diag || r == null ? 'default' : 'pointer',
                        }}>
                        {diag ? '1.00' : r == null ? 'N/A' : r.toFixed(2)}
                      </Box>
                    );
                  })}
                </React.Fragment>
              ))}
            </Box>
          </Box>
          <Stack gap={2} sx={{ width: { xs: '100%', md: 240 }, flexShrink: 0 }}>
            <Stack gap={1} sx={{ minHeight: 132, px: 2.25, py: 2, borderRadius: '14px', bgcolor: 'ui.pill.bg' }}>
              {hover && hr != null ? (
                <>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>{UNIVERSE[hover[0]].name} × {UNIVERSE[hover[1]].name} · {rangeLabel}</Typography>
                  <Typography sx={{ fontSize: 32, fontWeight: 800, color: hr >= 0 ? pal.pos : pal.neg }}>{signed(hr)}</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, color: 'text.secondary' }}>{desc(hr)}</Typography>
                </>
              ) : top ? (
                <>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>{t('corr.strongest', { range: rangeLabel })}</Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{UNIVERSE[top.i].name} × {UNIVERSE[top.j].name}</Typography>
                  <Typography sx={{ fontSize: 28, fontWeight: 800, color: top.r >= 0 ? pal.pos : pal.neg }}>{signed(top.r)}</Typography>
                </>
              ) : null}
            </Stack>
            {/* 색 범례 */}
            <Stack gap={0.75}>
              <Box sx={{ height: 12, borderRadius: '6px', background: (th: any) => `linear-gradient(90deg, ${pal.neg}, ${th.palette.ui.pill.bg} 50%, ${pal.pos})` }} />
              <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                <span>-1.00</span><span>-0.5</span><span>0</span><span>+0.5</span><span>+1.00</span>
              </Stack>
            </Stack>
          </Stack>
        </Stack>
      )}
    </Card>
  );
};

const Sep = () => <Box component="span" sx={{ width: '1px', height: 13, bgcolor: 'divider' }} />;

const Correlation: React.FC = () => {
  const { t } = useI18n();
  const pal = usePalette();
  return (
    <Stack gap={3} sx={{ maxWidth: 1440, mx: 'auto', pb: 4 }}>
      <Stack gap={1.5}>
        <Typography component="h1" sx={{ m: 0, fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: '-0.6px' }}>{t('corr.coef')}</Typography>
        <Stack direction="row" flexWrap="wrap" alignItems="center" columnGap={1.75} rowGap={1} sx={{ fontSize: 15, fontWeight: 500, color: 'text.secondary' }}>
          <span>{t('corr.i.range')} <Box component="b" sx={{ color: 'text.primary' }}>-1 ~ 1</Box></span>
          <Sep />
          <span><b style={{ color: pal.pos }}>1</b>{t('corr.i.pos')}</span>
          <Sep />
          <span><b style={{ color: pal.neg }}>-1</b>{t('corr.i.neg')}</span>
          <Sep />
          <span><Box component="b" sx={{ color: 'text.primary' }}>0</Box>{t('corr.i.zero')}</span>
          <Sep />
          <span>{t('corr.i.calc')}</span>
        </Stack>
        <Stack direction="row" flexWrap="wrap" alignItems="center" columnGap={2} rowGap={0.75} sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>
          <Stack direction="row" alignItems="center" gap={0.75}><Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: pal.pos }} />{t('corr.legPos')}</Stack>
          <Stack direction="row" alignItems="center" gap={0.75}><Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: pal.neg }} />{t('corr.legNeg')}</Stack>
          <Box component="span" sx={{ color: 'text.disabled' }}>{t('corr.thresholds')}</Box>
        </Stack>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
        <VsCard baseId="BTC" name="Bitcoin" />
        <VsCard baseId="ETH" name="Ethereum" />
      </Box>
      <Heatmap />
    </Stack>
  );
};

export default Correlation;
