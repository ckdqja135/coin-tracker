import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Menu, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import { useI18n } from '../i18n';
import { fmtCompact } from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { FEED_EXCHANGES, FeedExchange, FeedTrade, useTradeFeed } from '../lib/useTradeFeed';
import { fetchTickers } from '../services/market';

const COINS = [{ id: 'BTC', name: 'Bitcoin' }, { id: 'ETH', name: 'Ethereum' }] as const;
const LONG = '#4dbf9a';
const SHORT = '#e06666';
const CARD = '#1f2024';
const EX_META: Record<FeedExchange, { label: string; color: string }> = {
  binance: { label: 'Binance', color: '#f0b90b' },
  bybit: { label: 'Bybit', color: '#f7a600' },
  okx: { label: 'OKX', color: '#3d6cf4' },
  bitget: { label: 'Bitget', color: '#00c4b3' },
};
const WINDOWS = [
  { key: '5m', ms: 5 * 60_000 },
  { key: '15m', ms: 15 * 60_000 },
  { key: '30m', ms: 30 * 60_000 },
  { key: '1h', ms: 3600_000 },
  { key: '4h', ms: 4 * 3600_000 },
];
const THRESHOLDS = [100_000, 1_000_000, 10_000_000];

/** 체결 규모 단계 (물방울 개수) */
const tier = (usd: number) => (usd >= 10_000_000 ? 3 : usd >= 1_000_000 ? 2 : 1);

const Drops: React.FC<{ usd: number; color: string }> = ({ usd, color }) => (
  <Stack direction="row" gap={0.4}>
    {[1, 2, 3].map(i => (
      <Box key={i} sx={{ width: 7, height: 10, bgcolor: i <= tier(usd) ? color : '#c9ccd2', borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%' }} />
    ))}
  </Stack>
);

const SizeBadge: React.FC<{ usd: number; side: 'buy' | 'sell' }> = ({ usd, side }) => (
  <Box sx={{
    bgcolor: side === 'buy' ? '#3f9b6c' : '#d35b5b', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 0.5,
    px: 0.8, py: 0.2, width: 78, flexShrink: 0, display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums',
  }}>
    <span>$</span><span>{fmtCompact(usd)}</span>
  </Box>
);

const age = (now: number, t: number) => {
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const useNow = (ms: number) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
};

/** 롱 비중을 원호로 보여주는 게이지 */
const Gauge: React.FC<{ longShare: number | null; net: number; unit: string }> = ({ longShare, net, unit }) => {
  const r = 32;
  const c = 2 * Math.PI * r;
  const share = longShare ?? 0.5;
  const isLong = net >= 0;
  const color = isLong ? LONG : SHORT;
  return (
    <Box sx={{ position: 'relative', width: 84, height: 84 }}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r + 6} fill="#111214" stroke={color} strokeOpacity={0.25} strokeWidth={1} />
        <circle cx="42" cy="42" r={r} fill="none" stroke={SHORT} strokeWidth={4} strokeDasharray={`${c * (1 - share)} ${c}`}
          transform={`rotate(${-90 + share * 360} 42 42)`} strokeLinecap="round" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={LONG} strokeWidth={4} strokeDasharray={`${c * share} ${c}`}
          transform="rotate(-90 42 42)" strokeLinecap="round" />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color }}>
        <Typography sx={{ fontSize: 10, lineHeight: 1 }}>{isLong ? '↗' : '↘'}</Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>{isLong ? 'Long' : 'Short'}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>{unit}{fmtCompact(Math.abs(net)).replace('.00', '')}</Typography>
      </Box>
    </Box>
  );
};

const ExchangeCard: React.FC<{
  ex: FeedExchange; coin: string; trades: FeedTrade[]; now: number;
  volume: (ex: FeedExchange, ms: number) => { buy: number; sell: number };
}> = ({ ex, coin, trades, now, volume }) => {
  const [win, setWin] = useState(WINDOWS[0]);
  const [inCoin, setInCoin] = useState(false);
  const meta = EX_META[ex];
  const { buy, sell } = volume(ex, win.ms);
  const total = buy + sell;
  const price = trades[0]?.price;
  // USD <-> 코인 수량 전환 (최근 체결가 기준 환산)
  const conv = (usd: number) => (inCoin && price ? usd / price : usd);
  const fmtAmt = (usd: number) => Math.round(conv(usd)).toLocaleString('en-US');
  const recent = trades.filter(t => t.exchange === ex).slice(0, 3);

  return (
    <Box sx={{ bgcolor: CARD, color: '#fff', borderRadius: 1.5, position: 'relative', mb: 3, border: '1px solid #2c2e33', overflow: 'hidden' }}>
      <Select size="small" value={win.key} onChange={e => setWin(WINDOWS.find(w => w.key === e.target.value)!)} variant="standard" disableUnderline
        sx={{ position: 'absolute', top: 0, right: 0, bgcolor: '#111214', color: '#fff', fontSize: 11, px: 1, borderBottomLeftRadius: 6, '& .MuiSvgIcon-root': { color: '#fff', fontSize: 14 } }}>
        {WINDOWS.map(w => <MenuItem key={w.key} value={w.key} sx={{ fontSize: 12 }}>{w.key}</MenuItem>)}
      </Select>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" gap={0.8}>
          <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: meta.color }} />
          <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{meta.label}</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: -0.5 }}>
          <Box sx={{ mt: 4 }}>
            <Typography sx={{ fontSize: 11 }}>Long</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: LONG }}>{total ? ((buy / total) * 100).toFixed(2) : '0.00'}%</Typography>
            <Typography sx={{ fontSize: 11, color: LONG }}>{fmtAmt(buy)}</Typography>
          </Box>
          <Gauge longShare={total ? buy / total : null} net={conv(buy - sell)} unit={inCoin ? '' : ''} />
          <Box sx={{ mt: 4, textAlign: 'right' }}>
            <Typography sx={{ fontSize: 11 }}>Short</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: SHORT }}>{total ? ((sell / total) * 100).toFixed(2) : '0.00'}%</Typography>
            <Typography sx={{ fontSize: 11, color: SHORT }}>{fmtAmt(sell)}</Typography>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ borderTop: '1px solid #2c2e33', mx: 2 }} />
      <Box sx={{ p: 2, pt: 1.5 }}>
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
          <Button size="small" onClick={() => setInCoin(v => !v)}
            sx={{ bgcolor: '#1d2a4a', color: '#6f9cff', fontSize: 10, minWidth: 0, px: 1, py: 0.2 }}>{inCoin ? coin : 'USD'} ⇄</Button>
        </Stack>
        {recent.map(t => (
          <Stack key={t.id} direction="row" alignItems="center" gap={1.5} sx={{ py: 0.4, fontSize: 11 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, width: 80, fontVariantNumeric: 'tabular-nums' }}>$ {t.price.toFixed(2)}</Typography>
            <SizeBadge usd={t.usd} side={t.side} />
            <Drops usd={t.usd} color={t.side === 'buy' ? LONG : SHORT} />
            <Typography sx={{ fontSize: 11, color: '#9aa1ad', ml: 'auto' }}>{age(now, t.time)}</Typography>
          </Stack>
        ))}
      </Box>
    </Box>
  );
};

// 새 대형 체결 알림음
const beep = (() => {
  let ctx: AudioContext | null = null;
  return (up: boolean) => {
    try {
      ctx = ctx ?? new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = up ? 880 : 440;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch { /* 오디오 미지원 */ }
  };
})();

const LongShort: React.FC = () => {
  const { t } = useI18n();
  const [coin, setCoin] = useState<string>('BTC');
  const [minUsd, setMinUsd] = useState(THRESHOLDS[0]);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const { bigTrades, connected, volume } = useTradeFeed(coin, minUsd, paused, tr => { if (!mutedRef.current) beep(tr.side === 'buy'); });
  const now = useNow(1000);
  const ticker = useAsync(() => fetchTickers('binance', [coin]), [coin], 3000);
  const tk = ticker.data?.data[coin];
  const chgAbs = tk && tk.change24h != null ? tk.price - tk.price / (1 + tk.change24h / 100) : null;
  const coinName = COINS.find(c => c.id === coin)!.name;

  const roundBtn = { width: 32, height: 32, border: 1, borderColor: 'text.secondary', color: 'text.primary', fontSize: 13 };

  return (
    <Box>
      <Typography sx={{ fontSize: 24, fontWeight: 800, mb: 2.5 }}>{t('ls.title')}</Typography>
      <Stack direction="row" gap={1} sx={{ mb: 3 }}>
        {COINS.map(c => (
          <Button key={c.id} onClick={() => setCoin(c.id)}
            sx={{ borderRadius: 99, px: 2, py: 0.6, fontSize: 13, fontWeight: 700, bgcolor: coin === c.id ? '#3d6cf4' : '#23262d', color: '#fff', '&:hover': { bgcolor: coin === c.id ? '#3159d6' : '#33363d' } }}>
            {c.name}
          </Button>
        ))}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '300px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
        <Box>
          {FEED_EXCHANGES.map(ex => (
            <ExchangeCard key={ex} ex={ex} coin={coin} trades={bigTrades} now={now} volume={volume} />
          ))}
        </Box>

        <Box sx={{ border: 1, borderColor: 'text.secondary', borderRadius: 0.5, p: 2, minHeight: 600 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ pb: 2, borderBottom: 1, borderColor: 'text.secondary' }}>
            <Typography sx={{ fontSize: 17, fontWeight: 800, flexGrow: 1 }}>{t('ls.significant')}</Typography>
            <Tooltip title={muted ? t('ls.unmute') : t('ls.mute')}>
              <IconButton size="small" sx={roundBtn} onClick={() => setMuted(m => !m)}>{muted ? '🔇' : '🔊'}</IconButton>
            </Tooltip>
            <Tooltip title={paused ? t('ls.resume') : t('ls.pause')}>
              <IconButton size="small" sx={roundBtn} onClick={() => setPaused(p => !p)}>{paused ? '▶' : '❚❚'}</IconButton>
            </Tooltip>
            <Tooltip title={t('ls.settings')}>
              <IconButton size="small" sx={roundBtn} onClick={e => setMenuEl(e.currentTarget)}>⚙</IconButton>
            </Tooltip>
            <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
              {THRESHOLDS.map(th => (
                <MenuItem key={th} selected={th === minUsd} onClick={() => { setMinUsd(th); setMenuEl(null); }}>
                  {t('ls.minSize')} ${fmtCompact(th)}
                </MenuItem>
              ))}
            </Menu>
          </Stack>

          <Stack direction="row" alignItems="center" sx={{ bgcolor: '#1f2024', color: '#fff', borderRadius: 0.5, px: 1.5, py: 1, mt: 1.5, mb: 1 }}>
            <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#f7931a', mr: 1 }} />
            <Typography sx={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{coinName}</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1, textAlign: 'center' }}>
              {tk ? `$ ${tk.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '-'}
            </Typography>
            <Typography sx={{ fontSize: 11, flex: 1, textAlign: 'right', color: (tk?.change24h ?? 0) >= 0 ? '#fff' : SHORT }}>
              {chgAbs != null ? `${chgAbs >= 0 ? '+' : ''}${chgAbs.toFixed(2)}` : ''}&nbsp;&nbsp;
              {tk?.change24h != null ? `${tk.change24h >= 0 ? '+' : ''}${tk.change24h.toFixed(2)} %` : ''}
            </Typography>
          </Stack>

          {bigTrades.length === 0 && (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6, fontSize: 13 }}>
              {Object.values(connected).some(Boolean) ? t('ls.waiting') : t('ls.disconnected')}
            </Typography>
          )}
          {bigTrades.slice(0, 40).map(tr => {
            const color = tr.side === 'buy' ? LONG : SHORT;
            return (
              <Stack key={tr.id} direction="row" alignItems="center" sx={{ py: 0.6, fontSize: 12 }}>
                <Box sx={{ width: 28, color, fontWeight: 700 }}>{tr.side === 'buy' ? '↗' : '↘'}</Box>
                <Typography sx={{ width: { xs: 56, sm: 90 }, fontSize: 12, color: 'text.secondary' }} noWrap>{EX_META[tr.exchange].label}</Typography>
                <Typography sx={{ flex: 1, fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'block' } }}>$ {tr.price.toFixed(2)}</Typography>
                <Box sx={{ flex: 1 }}><SizeBadge usd={tr.usd} side={tr.side} /></Box>
                <Box sx={{ flex: 1, minWidth: 30 }}><Drops usd={tr.usd} color={color} /></Box>
                <Typography sx={{ width: { xs: 50, sm: 70 }, textAlign: 'right', fontSize: 12, color: 'text.secondary' }}>{age(now, tr.time)}</Typography>
              </Stack>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default LongShort;
