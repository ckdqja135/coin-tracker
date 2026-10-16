import React, { useEffect, useRef, useState } from 'react';
import { Box, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import CoinIcon from '../components/CoinIcon';
import LiquidationPanel from '../components/LiquidationPanel';
import { TKey, useI18n } from '../i18n';
import { fmtCompact } from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { DOWN, UP } from '../lib/vsRef';
import { FEED_EXCHANGES, FeedExchange, FeedTrade, useTradeFeed } from '../lib/useTradeFeed';
import { AccountRatio, fetchAccountRatio, fetchTickers } from '../services/market';

const COINS = [{ id: 'BTC', name: 'Bitcoin' }, { id: 'ETH', name: 'Ethereum' }] as const;
const LONG = UP;
const SHORT = DOWN;
const LONG_BG = 'rgba(38,166,154,0.12)';
const SHORT_BG = 'rgba(239,83,80,0.10)';
const EX_META: Record<FeedExchange, { label: string; color: string }> = {
  binance: { label: 'Binance', color: '#e8b007' },
  bybit: { label: 'Bybit', color: '#f2780c' },
  okx: { label: 'OKX', color: '#5b6472' },
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

/** 체결 규모 단계 (점 개수): 3단계면 금액 배지를 진하게 채운다 */
const tier = (usd: number) => (usd >= 10_000_000 ? 3 : usd >= 1_000_000 ? 2 : 1);

const useNow = (ms: number) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
};

/** 경과 시간: 방금 / n초 전 / n분 전 / n시간 n분 전 */
const useAgo = () => {
  const { t } = useI18n();
  return (now: number, time: number) => {
    const s = Math.max(0, Math.floor((now - time) / 1000));
    if (s < 5) return t('ls.agoNow');
    if (s < 60) return t('ls.agoSec', { n: String(s) });
    const m = Math.floor(s / 60);
    if (m < 60) return t('ls.agoMin', { n: String(m) });
    return t('ls.agoHour', { h: String(Math.floor(m / 60)), m: String(m % 60) });
  };
};

/** 회색 바탕에 고른 것만 흰 버튼인 탭 */
const segBtn = (active: boolean) => ({
  height: 28, px: 1.5, border: 0, borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
  bgcolor: active ? 'background.paper' : 'transparent', color: active ? 'text.primary' : 'text.secondary',
  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
});

const selectSx = { height: 32, fontSize: 13, fontWeight: 700, borderRadius: 2, bgcolor: 'background.paper', '& fieldset': { borderColor: 'divider' } };

/** 체결 금액 배지: 큰 체결(3단계)은 색을 채운다 */
const Amount: React.FC<{ tr: FeedTrade; inCoin: boolean; coin: string; minWidth?: number }> = ({ tr, inCoin, coin, minWidth = 0 }) => {
  const buy = tr.side === 'buy';
  const strong = tier(tr.usd) === 3;
  return (
    <Box component="span" sx={{
      height: 28, minWidth, boxSizing: 'border-box', borderRadius: '7px', px: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
      bgcolor: strong ? (buy ? LONG : SHORT) : (buy ? LONG_BG : SHORT_BG), color: strong ? '#fff' : (buy ? LONG : SHORT),
    }}>
      {inCoin ? `${(tr.usd / tr.price).toFixed(coin === 'BTC' ? 2 : 1)} ${coin}` : `$${fmtCompact(tr.usd)}`}
    </Box>
  );
};

const Dots: React.FC<{ tr: FeedTrade }> = ({ tr }) => (
  <Stack direction="row" justifyContent="center" gap={0.375}>
    {[1, 2, 3].map(i => (
      <Box key={i} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: i <= tier(tr.usd) ? (tr.side === 'buy' ? LONG : SHORT) : 'divider' }} />
    ))}
  </Stack>
);

const Card: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '18px', ...sx }}>{children}</Box>
);

const ExchangeCard: React.FC<{
  ex: FeedExchange; coin: string; trades: FeedTrade[]; now: number; inCoin: boolean; onToggleUnit: () => void;
  volume: (ex: FeedExchange, key: string, ms: number) => { buy: number; sell: number };
  collectingMinutes: (ex: FeedExchange, ms: number) => number | null;
  account: AccountRatio | null | undefined;
}> = ({ ex, coin, trades, now, inCoin, onToggleUnit, volume, collectingMinutes, account }) => {
  const { t } = useI18n();
  const ago = useAgo();
  const [win, setWin] = useState(WINDOWS[0]);
  const meta = EX_META[ex];
  const { buy, sell } = volume(ex, win.key, win.ms);
  const collecting = collectingMinutes(ex, win.ms);
  const total = buy + sell;
  const longPct = total ? (buy / total) * 100 : null;
  const price = trades[0]?.price;
  // USD <-> 코인 수량 전환 (최근 체결가 기준 환산)
  const fmtAmt = (usd: number) => (inCoin && price ? `${(usd / price).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${coin}` : `$${fmtCompact(usd)}`);
  const recent = trades.filter(tr => tr.exchange === ex).slice(0, 3);
  const winLabel = t(`ls.win.${win.key}` as TKey);

  return (
    <Card sx={{ px: 2.75, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Stack direction="row" alignItems="center" gap={1.25}>
        <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: meta.color }} />
        <Typography sx={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{meta.label}</Typography>
        <Select size="small" value={win.key} onChange={e => setWin(WINDOWS.find(w => w.key === e.target.value)!)} sx={selectSx}>
          {WINDOWS.map(w => <MenuItem key={w.key} value={w.key} sx={{ fontSize: 13 }}>{t(`ls.win.${w.key}` as TKey)}</MenuItem>)}
        </Select>
      </Stack>

      {/* 테이커 롱/숏: 시장가 매수·매도 체결 금액 비율 */}
      <Stack gap={1.25}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>{t('ls.taker')} · {winLabel}</Typography>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Stack gap={0.25}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{t('ls.long')}</Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: LONG, fontVariantNumeric: 'tabular-nums' }}>{longPct == null ? '-' : `${longPct.toFixed(1)}%`}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{fmtAmt(buy)}</Typography>
          </Stack>
          <Stack gap={0.25} alignItems="flex-end">
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{t('ls.short')}</Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: SHORT, fontVariantNumeric: 'tabular-nums' }}>{longPct == null ? '-' : `${(100 - longPct).toFixed(1)}%`}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{fmtAmt(sell)}</Typography>
          </Stack>
        </Stack>
        <Stack direction="row" gap="3px" sx={{ height: 10, borderRadius: '5px', overflow: 'hidden', bgcolor: 'ui.pill.bg' }}>
          {longPct != null && (
            <>
              <Box sx={{ width: `${longPct}%`, bgcolor: LONG, transition: 'width .4s' }} />
              <Box sx={{ flex: 1, bgcolor: SHORT }} />
            </>
          )}
        </Stack>
        {/* 서버가 아직 이 기간만큼 모으지 못했으면 알려준다 */}
        {collecting != null && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('ls.collecting', { min: String(collecting) })}</Typography>}
      </Stack>

      {/* 거래소가 공개하는 계정 롱/숏 비율 (실제 포지션을 가진 계정 비중) */}
      <Stack direction="row" alignItems="center" gap={1.75} sx={{ px: 1.75, py: 1.5, borderRadius: '12px', bgcolor: 'ui.pill.bg' }}>
        <Stack sx={{ flex: 1, gap: 0.875 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 13 }}>
            <Tooltip title={t('ls.accountHelp')}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary', cursor: 'help' }}>{t('ls.account')}</Typography>
            </Tooltip>
            <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {account ? (
                <><span style={{ color: LONG }}>{(account.long * 100).toFixed(1)}%</span> / <span style={{ color: SHORT }}>{(account.short * 100).toFixed(1)}%</span></>
              ) : (account === null ? '-' : '…')}
            </Typography>
          </Stack>
          <Stack direction="row" gap="2px" sx={{ height: 5, borderRadius: '3px', overflow: 'hidden', bgcolor: 'divider' }}>
            {account && (
              <>
                <Box sx={{ width: `${account.long * 100}%`, bgcolor: LONG }} />
                <Box sx={{ flex: 1, bgcolor: SHORT }} />
              </>
            )}
          </Stack>
        </Stack>
        <Stack alignItems="flex-end" sx={{ pl: 1.75, borderLeft: 1, borderColor: 'divider' }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'text.secondary' }}>{t('ls.ratio')}</Typography>
          <Typography sx={{ fontSize: 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{account ? account.ratio.toFixed(2) : '-'}</Typography>
        </Stack>
      </Stack>

      {/* 이 거래소의 최근 대량 체결 3건 */}
      <Stack gap={0.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>{t('ls.recentBig')}</Typography>
          <Box component="button" type="button" onClick={onToggleUnit} sx={{
            height: 26, px: 1.125, border: 0, borderRadius: '7px', bgcolor: 'ui.highlight.bg', color: 'ui.highlight.fg', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          }}>{inCoin ? coin : 'USD'} ⇄</Box>
        </Stack>
        {recent.map(tr => (
          <Box key={tr.id} sx={{ display: 'grid', gridTemplateColumns: '18px 1fr 104px 64px', alignItems: 'center', gap: 1.25, height: 36 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: tr.side === 'buy' ? LONG : SHORT }}>{tr.side === 'buy' ? '↗' : '↘'}</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${tr.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Typography>
            <Amount tr={tr} inCoin={inCoin} coin={coin} />
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', textAlign: 'right' }}>{ago(now, tr.time)}</Typography>
          </Box>
        ))}
        {!recent.length && <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 1 }}>{t('ls.none')}</Typography>}
      </Stack>
    </Card>
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
  const ago = useAgo();
  const [coin, setCoin] = useState<string>('BTC');
  const [minUsd, setMinUsd] = useState(THRESHOLDS[0]);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [sideF, setSideF] = useState<'all' | 'buy' | 'sell'>('all');
  const [exF, setExF] = useState<FeedExchange | 'all'>('all');
  const [inCoin, setInCoin] = useState(false);
  const filterRef = useRef({ muted, sideF, exF });
  filterRef.current = { muted, sideF, exF };

  // 알림음은 지금 보고 있는 조건(방향·거래소)에 맞는 체결에만 울린다
  const { bigTrades, connected, volume, collectingMinutes } = useTradeFeed(coin, minUsd, paused, tr => {
    const f = filterRef.current;
    if (!f.muted && (f.sideF === 'all' || f.sideF === tr.side) && (f.exF === 'all' || f.exF === tr.exchange)) beep(tr.side === 'buy');
  });
  const now = useNow(1000);
  const ticker = useAsync(() => fetchTickers('binance', [coin]), [coin], 3000);
  // 거래소별 계정 롱/숏 비율 (5분 단위로 갱신되는 값이라 1분마다 받는다)
  const accounts = useAsync(async () => {
    const list = await Promise.all(FEED_EXCHANGES.map(ex => fetchAccountRatio(ex, coin).catch(() => null)));
    return Object.fromEntries(FEED_EXCHANGES.map((ex, i) => [ex, list[i]])) as Record<FeedExchange, AccountRatio | null>;
  }, [coin], 60_000);
  const tk = ticker.data?.data[coin];
  const chgAbs = tk && tk.change24h != null ? tk.price - tk.price / (1 + tk.change24h / 100) : null;
  const coinName = COINS.find(c => c.id === coin)!.name;
  const live = Object.values(connected).some(Boolean);

  // 새로 들어온 체결 줄을 잠깐 강조한다
  const [flash, setFlash] = useState<string | null>(null);
  const newest = bigTrades[0]?.id;
  useEffect(() => {
    if (!newest) return;
    setFlash(newest);
    const id = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(id);
  }, [newest]);

  const feed = bigTrades.filter(tr => (sideF === 'all' || tr.side === sideF) && (exF === 'all' || tr.exchange === exF)).slice(0, 40);
  const cols = '64px 100px 1fr 130px 64px 92px';

  return (
    <Stack gap={3} sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 0, md: 1 }, pb: 4 }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={2.5}>
        <Typography component="h1" sx={{ m: 0, fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: '-0.6px' }}>{t('ls.title')}</Typography>
        <Stack direction="row" gap={0.25} sx={{ p: 0.5, borderRadius: '12px', bgcolor: 'ui.pill.bg' }}>
          {COINS.map(c => (
            <Box key={c.id} component="button" type="button" onClick={() => setCoin(c.id)} aria-pressed={coin === c.id}
              sx={{ ...segBtn(coin === c.id), height: 36, pl: 1.25, pr: 2, borderRadius: '9px', fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CoinIcon symbol={c.id} size={20} />{c.name}
            </Box>
          ))}
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('ls.explain')}</Typography>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '420px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
        <Stack gap={2}>
          {FEED_EXCHANGES.map(ex => (
            <ExchangeCard key={ex} ex={ex} coin={coin} trades={bigTrades} now={now} volume={volume} inCoin={inCoin} onToggleUnit={() => setInCoin(v => !v)}
              collectingMinutes={collectingMinutes} account={accounts.data?.[ex]} />
          ))}
        </Stack>

        <Card sx={{ display: 'flex', flexDirection: 'column', position: { lg: 'sticky' }, top: { lg: 112 }, overflow: 'hidden' }}>
          <Stack gap={1.5} sx={{ px: 2.75, py: 2.25, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{t('ls.significant')}</Typography>
            {/* 실시간 / 일시정지 / 재연결 중 */}
            <Stack direction="row" alignItems="center" gap={0.75} sx={{
              height: 24, px: 1.125, borderRadius: 99, fontSize: 12, fontWeight: 800,
              bgcolor: paused || !live ? 'ui.pill.bg' : LONG_BG, color: paused || !live ? 'text.secondary' : LONG,
            }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'currentColor' }} />
              {paused ? t('ls.paused') : live ? t('ls.live') : t('ls.disconnected')}
            </Stack>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={muted ? t('ls.unmute') : t('ls.mute')}>
              <Box component="button" type="button" onClick={() => setMuted(m => !m)} aria-pressed={!muted} sx={{
                height: 34, px: 1.25, border: 1, borderColor: 'divider', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                bgcolor: muted ? 'background.paper' : 'ui.highlight.bg', color: muted ? 'text.secondary' : 'ui.highlight.fg',
              }}>{muted ? t('ls.soundOff') : t('ls.soundOn')}</Box>
            </Tooltip>
            <Tooltip title={paused ? t('ls.resume') : t('ls.pause')}>
              <Box component="button" type="button" onClick={() => setPaused(p => !p)} aria-label={paused ? t('ls.resume') : t('ls.pause')} sx={{
                width: 34, height: 34, border: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2, fontSize: 12, fontWeight: 800, cursor: 'pointer',
              }}>{paused ? '▶' : '❚❚'}</Box>
            </Tooltip>
          </Stack>
          {/* 필터: 방향 · 거래소 · 최소 규모 */}
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
            <Stack direction="row" gap={0.25} sx={{ p: '3px', borderRadius: '9px', bgcolor: 'ui.pill.bg' }}>
              {(['all', 'buy', 'sell'] as const).map(k => (
                <Box key={k} component="button" type="button" onClick={() => setSideF(k)} aria-pressed={sideF === k} sx={segBtn(sideF === k)}>
                  {k === 'all' ? t('ls.all') : k === 'buy' ? t('ls.long') : t('ls.short')}
                </Box>
              ))}
            </Stack>
            <Select size="small" value={exF} onChange={e => setExF(e.target.value as FeedExchange | 'all')} sx={{ ...selectSx, height: 34 }}>
              <MenuItem value="all" sx={{ fontSize: 13 }}>{t('ls.allExchanges')}</MenuItem>
              {FEED_EXCHANGES.map(ex => <MenuItem key={ex} value={ex} sx={{ fontSize: 13 }}>{EX_META[ex].label}</MenuItem>)}
            </Select>
            <Tooltip title={t('ls.settings')}>
              <Select size="small" value={minUsd} onChange={e => setMinUsd(Number(e.target.value))} sx={{ ...selectSx, height: 34 }}>
                {THRESHOLDS.map(th => <MenuItem key={th} value={th} sx={{ fontSize: 13 }}>{t('ls.minOver', { v: `$${fmtCompact(th)}` })}</MenuItem>)}
              </Select>
            </Tooltip>
          </Stack>
          </Stack>
          {/* 현재가 */}
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ mx: 2.75, mt: 2, mb: 0.75, px: 2.25, py: 1.75, borderRadius: '14px', bgcolor: 'ui.highlight.bg' }}>
            <CoinIcon symbol={coin} size={26} />
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'ui.highlight.fg' }}>{coinName}</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: { xs: 18, md: 24 }, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {tk ? `$${tk.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, minWidth: { md: 130 }, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (tk?.change24h ?? 0) >= 0 ? LONG : SHORT }}>
              {chgAbs != null && tk?.change24h != null ? `${chgAbs >= 0 ? '+' : ''}${chgAbs.toFixed(2)} (${tk.change24h >= 0 ? '+' : ''}${tk.change24h.toFixed(2)}%)` : ''}
            </Typography>
          </Stack>

          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: cols, gap: 1.5, px: 2.75, py: 1.25, fontSize: 12.5, fontWeight: 700, color: 'text.secondary', borderBottom: 1, borderColor: 'divider' }}>
                <span>{t('ls.colSide')}</span><span>{t('ls.colEx')}</span><span>{t('ls.colPrice')}</span>
                <Box component="span" sx={{ textAlign: 'right' }}>{t('ls.colAmount')}</Box>
                <Box component="span" sx={{ textAlign: 'center' }}>{t('ls.colSize')}</Box>
                <Box component="span" sx={{ textAlign: 'right' }}>{t('ls.colTime')}</Box>
              </Box>
              <Stack sx={{ px: 1.25, pt: 0.5, pb: 1.5, maxHeight: 880, overflowY: 'auto' }}>
                {feed.map(tr => {
                  const buy = tr.side === 'buy';
                  return (
                    <Box key={tr.id} sx={{
                      display: 'grid', gridTemplateColumns: cols, gap: 1.5, alignItems: 'center', height: 48, px: 1.5, borderRadius: '10px',
                      bgcolor: flash === tr.id ? 'ui.highlight.bg' : 'transparent', transition: 'background-color 1.2s', '&:hover': { bgcolor: 'ui.pill.bg' },
                    }}>
                      <Box component="span" sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5, width: 'fit-content', height: 24, px: 1, borderRadius: '6px', fontSize: 12.5, fontWeight: 800,
                        bgcolor: buy ? LONG_BG : SHORT_BG, color: buy ? LONG : SHORT,
                      }}>{buy ? '↗' : '↘'} {buy ? t('ls.long') : t('ls.short')}</Box>
                      <Stack direction="row" alignItems="center" gap={0.875} sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary' }}>
                        <Box sx={{ width: 9, height: 9, borderRadius: '3px', bgcolor: EX_META[tr.exchange].color }} />{EX_META[tr.exchange].label}
                      </Stack>
                      <Typography sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${tr.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Typography>
                      <Box sx={{ justifySelf: 'end' }}><Amount tr={tr} inCoin={inCoin} coin={coin} minWidth={96} /></Box>
                      <Dots tr={tr} />
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'right' }}>{ago(now, tr.time)}</Typography>
                    </Box>
                  );
                })}
                {!feed.length && (
                  <Typography sx={{ py: 5, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}>
                    {!live ? t('ls.disconnected') : bigTrades.length ? t('ls.none') : t('ls.waiting')}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>
        </Card>
      </Box>

      <LiquidationPanel coin={coin} />
    </Stack>
  );
};

export default LongShort;
