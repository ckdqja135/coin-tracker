import React, { useMemo } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { TKey, useI18n } from '../i18n';
import { NEW_COLOR, useNotices } from '../lib/newListings';
import { Fact, Mover, Tone, signed, summarizeCoin, summarizeMarket } from '../lib/summary';
import { useAsync } from '../lib/useAsync';
import { DOWN, UP } from '../lib/vsRef';
import { ExchangeTickers, TickerExchange, fetchTickers } from '../services/market';

const TONE: Record<Tone, string> = { up: UP, down: DOWN, warn: NEW_COLOR, info: 'primary.main', muted: 'text.secondary' };

const Help: React.FC<{ title: string }> = ({ title }) => (
  <Tooltip title={title}><Box component="span" sx={{ color: 'text.secondary', cursor: 'help', fontSize: 13 }}>ⓘ</Box></Tooltip>
);

/** 사실 하나: 강조할 것은 옅은 배경을 깐다 */
const FactItem: React.FC<{ fact: Fact }> = ({ fact }) => {
  const { t } = useI18n();
  const color = TONE[fact.tone];
  return (
    <Box component="span" sx={{
      fontSize: 12.5, fontWeight: fact.strong ? 800 : 600, color, whiteSpace: { xs: 'normal', sm: 'nowrap' },
      ...(fact.strong ? { px: 0.75, py: 0.25, borderRadius: 1, border: 1, borderColor: color } : {}),
    }}>
      {t(fact.key as TKey, fact.vars)}
    </Box>
  );
};

/** 선택 코인마다 한 줄 요약 (홈 모니터) */
export const CoinSummary: React.FC<{
  coins: string[]; base: TickerExchange; tickers: Partial<Record<TickerExchange, ExchangeTickers>>; images: Record<string, string | null>;
}> = ({ coins, base, tickers, images }) => {
  const { t } = useI18n();
  const notices = useNotices();
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 2, py: 1.5 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{t('sum.title')}</Typography>
        <Help title={t('sum.help')} />
      </Stack>
      {coins.map(coin => {
        const facts = summarizeCoin({ coin, base, tickers, notices });
        return (
          <Stack key={coin} direction="row" alignItems="flex-start" gap={1.25}
            sx={{ py: 0.75, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ width: 84, flexShrink: 0, minHeight: 24 }}>
              {images[coin] && <Box component="img" src={images[coin]!} alt="" sx={{ width: 16, height: 16 }} />}
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 800 }}>{coin}</Typography>
            </Stack>
            {/* 줄이 넘치면 코인 이름 아래가 아니라 사실 목록끼리 이어서 접는다 */}
            <Stack direction="row" alignItems="center" flexWrap="wrap" columnGap={1.25} rowGap={0.5} sx={{ minWidth: 0, minHeight: 24 }}>
              {facts.length
                ? facts.map((f, i) => <FactItem key={i} fact={f} />)
                : <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{t('sum.empty')}</Typography>}
            </Stack>
          </Stack>
        );
      })}
    </Box>
  );
};

const loadUpbit = () => fetchTickers('upbit', []);

const CoinLink: React.FC<{ coin: string; onPick: (c: string) => void; children?: React.ReactNode; color?: string }> = ({ coin, onPick, children, color }) => (
  <Box component="button" type="button" onClick={() => onPick(coin)} sx={{
    border: 0, bgcolor: 'transparent', p: 0, font: 'inherit', fontSize: 12.5, cursor: 'pointer', color: 'text.primary', fontWeight: 700,
    '&:hover': { textDecoration: 'underline' },
  }}>
    {coin}{children && <Box component="span" sx={{ color, ml: 0.5, fontWeight: 600 }}>{children}</Box>}
  </Box>
);

/** 한 묶음: 제목 + 코인 목록 */
const Group: React.FC<{ label: string; color?: string; children: React.ReactNode }> = ({ label, color, children }) => (
  <Stack direction="row" alignItems="center" gap={1} sx={{ whiteSpace: 'nowrap' }}>
    <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, color: color ?? 'text.secondary' }}>{label}</Typography>
    {children}
  </Stack>
);

const movers = (list: Mover[], onPick: (c: string) => void) =>
  list.map(m => <CoinLink key={m.coin} coin={m.coin} onPick={onPick} color={m.change > 0 ? UP : DOWN}>{signed(m.change, 1)}</CoinLink>);

/** 오늘 시장 요약 (홈 첫 화면): 업비트 원화마켓 등락 분포·상위 종목, 최근 24시간 상장·유의·종료 공지 */
export const MarketSummary: React.FC<{ onPick: (coin: string) => void }> = ({ onPick }) => {
  const { t } = useI18n();
  const notices = useNotices();
  const { data } = useAsync(loadUpbit, [], 30_000);
  const sum = useMemo(() => summarizeMarket(data, notices), [data, notices]);
  if (!data) return null;
  const coinsOf = (list: string[]) => list.map(c => <CoinLink key={c} coin={c} onPick={onPick} />);
  return (
    <Stack direction="row" alignItems="center" justifyContent="center" flexWrap="wrap" columnGap={2.5} rowGap={1}
      sx={{ mt: 4, px: 2, py: 1.25, border: 1, borderColor: 'divider', borderRadius: 2, maxWidth: 760 }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{t('mkt.title')}</Typography>
        <Help title={t('mkt.help')} />
      </Stack>
      {sum.btc != null && (
        <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, color: sum.btc > 0 ? UP : sum.btc < 0 ? DOWN : undefined }}>
          {t('mkt.btc', { v: signed(sum.btc) })}
        </Typography>
      )}
      <Typography component="span" sx={{ fontSize: 12.5, color: 'text.secondary' }}>
        {t('mkt.breadth', { up: String(sum.up), down: String(sum.down) })}
      </Typography>
      {sum.gainers.length > 0 && <Group label={t('mkt.gainers')}>{movers(sum.gainers, onPick)}</Group>}
      {sum.losers.length > 0 && <Group label={t('mkt.losers')}>{movers(sum.losers, onPick)}</Group>}
      {sum.listings.length > 0 && <Group label={t('mkt.listings')} color={NEW_COLOR}>{coinsOf(sum.listings)}</Group>}
      {sum.warnings.length > 0 && <Group label={t('mkt.warnings')} color={NEW_COLOR}>{coinsOf(sum.warnings)}</Group>}
      {sum.delistings.length > 0 && <Group label={t('mkt.delistings')} color={DOWN}>{coinsOf(sum.delistings)}</Group>}
    </Stack>
  );
};
