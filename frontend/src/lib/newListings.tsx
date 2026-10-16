import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { useI18n } from '../i18n';
import { exchangeMeta } from './exchanges';
import { useAsync } from './useAsync';
import { Notice, NoticeExchange, fetchNotices } from '../services/market';

/** 상장 공지가 올라온 뒤 이 기간 동안 NEW로 표시한다 */
export const NEW_FOR_MS = 7 * 86_400_000;
export const NEW_COLOR = '#f59e0b';

/** 코인별 최근 상장 정보: 상장한 거래소와 가장 이른 공지 시각 */
export type NewListing = { exchanges: NoticeExchange[]; time: number };
export type NewListings = Map<string, NewListing>;

/** 공지 목록에서 최근 상장 공지만 골라 코인별로 묶는다 */
export const newListingsOf = (notices: Notice[], now = Date.now()): NewListings => {
  const map: NewListings = new Map();
  notices
    .filter(n => n.kind === 'listing' && now - n.time < NEW_FOR_MS)
    .forEach(n => n.coins.forEach(c => {
      const cur = map.get(c);
      if (!cur) map.set(c, { exchanges: [n.exchange], time: n.time });
      else {
        if (!cur.exchanges.includes(n.exchange)) cur.exchanges.push(n.exchange);
        cur.time = Math.min(cur.time, n.time);
      }
    }));
  return map;
};

// 검색창·비교표·CIM이 같은 공지를 쓰므로 한 번 받은 결과를 잠시 공유한다
const TTL = 5 * 60_000;
let cache: { at: number; p: Promise<Notice[]> } | null = null;
const loadNotices = () => {
  if (!cache || Date.now() - cache.at > TTL) {
    const p = fetchNotices().catch(e => { cache = null; throw e; });
    cache = { at: Date.now(), p };
  }
  return cache.p;
};
const EMPTY: NewListings = new Map();
const loadNewListings = () => loadNotices().then(n => newListingsOf(n));

/** 최근 7일 안에 업비트·빗썸에 상장된 코인 (실패하면 빈 목록) */
export const useNewListings = (): NewListings => useAsync(loadNewListings, [], TTL).data ?? EMPTY;

/** 툴팁/title 문구: 예) Upbit · Bithumb 신규 상장 (10월 15일) */
export const useNewListingText = () => {
  const { t, lang } = useI18n();
  return (info: NewListing) => t('new.tip', {
    ex: info.exchanges.map(e => exchangeMeta(e).label).join(' · '),
    date: new Date(info.time).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Seoul' }),
  });
};

/** 코인 이름 옆에 붙이는 NEW 배지. withExchange면 상장 거래소 이름도 붙인다 */
export const NewBadge: React.FC<{ info: NewListing; withExchange?: boolean }> = ({ info, withExchange }) => {
  const text = useNewListingText();
  const label = withExchange ? `NEW · ${info.exchanges.map(e => exchangeMeta(e).label).join('·')}` : 'NEW';
  return (
    <Tooltip title={text(info)}>
      <Box component="span" sx={{
        px: 0.5, borderRadius: 0.75, fontSize: 9, fontWeight: 800, lineHeight: '15px', letterSpacing: 0.3,
        color: '#fff', bgcolor: NEW_COLOR, whiteSpace: 'nowrap', cursor: 'help', flexShrink: 0,
      }}>
        {label}
      </Box>
    </Tooltip>
  );
};
