import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, Link, Stack, Typography } from '@mui/material';
import ExchangeBadge from '../components/ExchangeBadge';
import { TKey, useI18n } from '../i18n';
import { exchangeMeta } from '../lib/exchanges';
import { useSelectedCoins } from '../lib/selectedCoins';
import { useAsync } from '../lib/useAsync';
import { DOWN, UP } from '../lib/vsRef';
import { Notice, NoticeExchange, NoticeKind, fetchNotices } from '../services/market';

type Filter = 'all' | 'listing' | 'risk';
const FILTERS: Filter[] = ['all', 'listing', 'risk'];
const KIND_COLOR: Record<NoticeKind, string | undefined> = { listing: UP, delisting: DOWN, warning: '#f59e0b', other: undefined };
const DAY = 86_400_000;

const match = (n: Notice, f: Filter) => f === 'all' || (f === 'listing' ? n.kind === 'listing' : n.kind === 'delisting' || n.kind === 'warning');

const fmtTime = (t: number, lang: string) => new Date(t).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul',
});

/** 업비트·빗썸 공지 모음: 상장 / 거래지원 종료 / 유의 종목을 한눈에 */
const Notices: React.FC = () => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { add } = useSelectedCoins();
  const [filter, setFilter] = useState<Filter>('all');
  const [exchange, setExchange] = useState<NoticeExchange | 'all'>('all');
  const { data, error, loading } = useAsync(fetchNotices, [], 60_000);
  const now = Date.now();
  const list = (data ?? []).filter(n => match(n, filter) && (exchange === 'all' || n.exchange === exchange));

  const pill = (active: boolean) => ({
    borderRadius: 99, px: 1.8, py: 0.4, fontSize: 13, fontWeight: 700, minWidth: 0,
    bgcolor: active ? 'primary.main' : 'ui.pill.bg', color: active ? '#fff' : 'ui.pill.fg', '&:hover': { bgcolor: active ? 'primary.dark' : 'ui.pill.hover' },
  });

  // 코인 칩을 누르면 홈 모니터에 추가하고 이동한다
  const watch = (coin: string) => {
    add(coin);
    navigate('/#monitor');
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontSize: 24, fontWeight: 800, mb: 0.5 }}>{t('notices.title')}</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2.5 }}>{t('notices.intro')}</Typography>

      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        {FILTERS.map(f => <Button key={f} sx={pill(filter === f)} onClick={() => setFilter(f)}>{t(`notices.filter.${f}` as TKey)}</Button>)}
        <Box sx={{ flexGrow: 1 }} />
        {(['all', 'upbit', 'bithumb'] as const).map(ex => (
          <Button key={ex} sx={pill(exchange === ex)} onClick={() => setExchange(ex)}>
            {ex === 'all' ? t('notices.allExchanges') : exchangeMeta(ex).label}
          </Button>
        ))}
      </Stack>

      {loading && !data && <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>…</Typography>}
      {error && !data && <Typography color="error" sx={{ py: 6, textAlign: 'center' }}>{error}</Typography>}
      {data && list.length === 0 && <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>{t('notices.empty')}</Typography>}

      {list.map(n => (
        <Stack key={n.url} direction="row" gap={1.5} alignItems="flex-start" sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ pt: 0.3 }}><ExchangeBadge ex={exchangeMeta(n.exchange)} size={22} /></Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" gap={0.8} flexWrap="wrap">
              {n.kind !== 'other' && (
                <Box component="span" sx={{ fontSize: 11, fontWeight: 800, color: '#fff', bgcolor: KIND_COLOR[n.kind], borderRadius: 0.5, px: 0.6, py: 0.1 }}>
                  {t(`notices.kind.${n.kind}` as TKey)}
                </Box>
              )}
              {now - n.time < DAY && <Box component="span" sx={{ fontSize: 10, fontWeight: 800, color: 'primary.main' }}>NEW</Box>}
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{n.category} · {fmtTime(n.time, lang)}</Typography>
            </Stack>
            <Link href={n.url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ display: 'block', color: 'text.primary', fontSize: 14, fontWeight: 600, mt: 0.3, wordBreak: 'keep-all' }}>
              {n.title}
            </Link>
            {n.coins.length > 0 && (
              <Stack direction="row" gap={0.6} sx={{ mt: 0.8 }}>
                {n.coins.map(c => (
                  <Chip key={c} size="small" label={`${c} ＋`} onClick={() => watch(c)} title={t('notices.watch')}
                    sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'ui.highlight.bg', color: 'ui.highlight.fg' }} />
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      ))}
    </Box>
  );
};

export default Notices;
