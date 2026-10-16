import React from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import CoinIcon from './CoinIcon';
import { TKey, useI18n } from '../i18n';
import { NEW_COLOR, useNotices } from '../lib/newListings';
import { Fact, Tone, summarizeCoin } from '../lib/summary';
import { useWallet } from '../lib/wallet';
import { DOWN, UP } from '../lib/vsRef';
import { ExchangeTickers, TickerExchange } from '../services/market';

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
  const wallet = useWallet(coins);
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 2, py: 1.5 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{t('sum.title')}</Typography>
        <Help title={t('sum.help')} />
      </Stack>
      {coins.map(coin => {
        const facts = summarizeCoin({ coin, base, tickers, notices, wallet });
        return (
          <Stack key={coin} direction="row" alignItems="flex-start" gap={1.25}
            sx={{ py: 0.75, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ width: 84, flexShrink: 0, minHeight: 24 }}>
              <CoinIcon symbol={coin} size={16} fallback={images[coin]} />
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
