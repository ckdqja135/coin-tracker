import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { Box, Button, InputBase, Link, Stack, Typography } from '@mui/material';
import { LogoMark } from '../components/Logo';
import { PageHeader } from '../components/Panel';
import { useI18n, Lang, TKey } from '../i18n';

type Category = 'crypto' | 'commodity' | 'international';
const CATEGORIES: Category[] = ['crypto', 'commodity', 'international'];

/** 글 상세에서 쓰는 블록: 문단, 비교 카드 2칸(상승/하락), 인용문 */
type Block =
  | { type: 'p'; text: string }
  | { type: 'pairs'; items: { tags: string[]; text: string; tone: 'up' | 'down' }[] }
  | { type: 'quote'; text: string };

interface Post {
  slug: string;
  date: string;
  tag: string;
  category: Category;
  title: Record<Lang, string>;
  /** 목록 미리보기·검색에 쓰는 문단 */
  body: Record<Lang, string[]>;
  /** 상세 화면 본문 (없으면 body를 문단으로 그린다). 첫 문단은 크게 보여준다 */
  blocks?: Record<Lang, Block[]>;
}

// 사이트 지표 해설용 자체 작성 글
const POSTS: Post[] = [
  {
    slug: 'open-interest',
    date: '2026-10-01',
    tag: 'Derivatives',
    category: 'crypto',
    title: { en: 'Reading Open Interest alongside price', ko: '가격과 함께 미결제약정 읽기' },
    body: {
      en: [
        'Open interest (OI) is the total value of futures contracts that are still open. It rises when new positions are opened and falls when positions are closed or liquidated.',
        'Price up with OI up usually means new leverage is entering the market. Price down with OI down often means positions are being closed or liquidated.',
        'A sharp OI drop together with a long candle is a typical sign of a liquidation cascade. Use the Impulse Monitor on the home page to overlay the two.',
      ],
      ko: [
        '미결제약정(OI)은 아직 청산되지 않은 선물 계약의 총 규모입니다. 새 포지션이 열리면 늘고, 포지션이 정리되거나 청산되면 줄어듭니다.',
        '가격과 OI가 함께 오르면 새로운 레버리지가 유입되고 있다는 뜻인 경우가 많습니다. 가격과 OI가 함께 내리면 포지션 정리나 청산이 진행 중일 가능성이 큽니다.',
        '긴 캔들과 함께 OI가 급감하면 연쇄 청산의 전형적인 신호입니다. 홈의 임펄스 모니터에서 두 지표를 겹쳐 볼 수 있습니다.',
      ],
    },
    blocks: {
      en: [
        { type: 'p', text: 'Open interest (OI) is the total value of futures contracts that are still open. It rises when new positions are opened and falls when positions are closed or liquidated.' },
        { type: 'p', text: 'Price up with OI up usually means new leverage is entering the market. Price down with OI down often means positions are being closed or liquidated.' },
        { type: 'pairs', items: [
          { tags: ['Price ↑', 'OI ↑'], text: 'New leverage coming in', tone: 'up' },
          { tags: ['Price ↓', 'OI ↓'], text: 'Positions closing · liquidations', tone: 'down' },
        ] },
        { type: 'quote', text: 'A sharp OI drop together with a long candle is a typical sign of a liquidation cascade.' },
        { type: 'p', text: 'Use the Impulse Monitor on the home page to overlay the two.' },
      ],
      ko: [
        { type: 'p', text: '미결제약정(OI)은 아직 청산되지 않은 선물 계약의 총 규모입니다. 새 포지션이 열리면 늘고, 포지션이 정리되거나 청산되면 줄어듭니다.' },
        { type: 'p', text: '가격과 OI가 함께 오르면 새로운 레버리지가 유입되고 있다는 뜻인 경우가 많습니다. 가격과 OI가 함께 내리면 포지션 정리나 청산이 진행 중일 가능성이 큽니다.' },
        { type: 'pairs', items: [
          { tags: ['가격 ↑', 'OI ↑'], text: '새로운 레버리지 유입', tone: 'up' },
          { tags: ['가격 ↓', 'OI ↓'], text: '포지션 정리 · 청산 진행', tone: 'down' },
        ] },
        { type: 'quote', text: '긴 캔들과 함께 OI가 급감하면 연쇄 청산의 전형적인 신호입니다.' },
        { type: 'p', text: '홈의 임펄스 모니터에서 두 지표를 겹쳐 볼 수 있습니다.' },
      ],
    },
  },
  {
    slug: 'kimchi-premium',
    date: '2026-09-20',
    tag: 'KRW',
    category: 'crypto',
    title: { en: 'What is the Kimchi Premium?', ko: '김치 프리미엄이란?' },
    body: {
      en: [
        'The Kimchi Premium is the gap between a coin\'s price on Korean exchanges (in KRW) and its global price converted at the USD/KRW rate.',
        'Here it is calculated as: KRW price ÷ (Binance USDT price × USD/KRW) − 1. A positive value means coins are more expensive in Korea.',
        'A rapidly rising premium often reflects strong local retail demand; a negative premium (reverse premium) can appear during local sell-offs.',
      ],
      ko: [
        '김치 프리미엄은 국내 거래소의 원화 가격과, 해외 가격을 원/달러 환율로 환산한 가격 사이의 차이입니다.',
        '이 사이트에서는 원화 가격 ÷ (바이낸스 USDT 가격 × 원/달러 환율) − 1 로 계산합니다. 양수면 국내 가격이 더 비싸다는 뜻입니다.',
        '프리미엄이 빠르게 오르면 국내 개인 수요가 강한 경우가 많고, 국내 매도세가 강할 때는 역프리미엄(음수)이 나타나기도 합니다.',
      ],
    },
  },
  {
    slug: 'long-short-ratio',
    date: '2026-09-05',
    tag: 'Sentiment',
    category: 'crypto',
    title: { en: 'How to use the Long/Short ratio', ko: '롱/숏 비율 활용법' },
    body: {
      en: [
        'The account long/short ratio shows how many accounts hold net long positions versus net short positions on an exchange.',
        'It measures crowd positioning, not money flow. An extremely one-sided ratio can signal crowded trades that are vulnerable to a squeeze.',
        'Compare exchanges on the Longs/Shorts page and watch large trades and liquidations in real time.',
      ],
      ko: [
        '계정 롱/숏 비율은 거래소에서 순매수(롱) 포지션을 가진 계정과 순매도(숏) 포지션을 가진 계정의 비율입니다.',
        '자금 규모가 아니라 참여자들의 쏠림을 보여주는 지표입니다. 한쪽으로 크게 치우치면 숏/롱 스퀴즈에 취약한 상태일 수 있습니다.',
        '롱/숏 페이지에서 거래소별 비율을 비교하고, 대규모 체결과 청산을 실시간으로 확인해 보세요.',
      ],
    },
  },
  {
    slug: 'gold-and-bitcoin',
    date: '2026-08-28',
    tag: 'Gold',
    category: 'commodity',
    title: { en: 'Comparing gold and bitcoin on one chart', ko: '금과 비트코인을 한 차트에서 비교하기' },
    body: {
      en: [
        'Gold and bitcoin are often grouped together as alternative stores of value, but their short-term moves can differ a lot.',
        'On the BTC page, open the "Gold" card and switch between 1W, 1M and 1Y. Short ranges show noise; longer ranges show whether the two trends line up.',
        'The Correlation page puts a number on it, so you can check whether the relationship is getting stronger or weaker over time.',
      ],
      ko: [
        '금과 비트코인은 대체 가치 저장 수단으로 함께 언급되지만, 단기 움직임은 꽤 다를 수 있습니다.',
        'BTC 페이지에서 "Gold" 카드를 열고 1W, 1M, 1Y를 바꿔 보세요. 짧은 기간은 잡음이 많고, 긴 기간에서는 두 추세가 같은 방향인지 확인할 수 있습니다.',
        '상관관계 페이지에서는 이 관계를 숫자로 보여주므로, 관계가 강해지는지 약해지는지 추적할 수 있습니다.',
      ],
    },
  },
  {
    slug: 'dollar-index',
    date: '2026-08-10',
    tag: 'Macro',
    category: 'international',
    title: { en: 'Why traders watch the US Dollar Index', ko: '트레이더가 달러 인덱스를 보는 이유' },
    body: {
      en: [
        'The US Dollar Index (DXY) tracks the dollar against a basket of major currencies.',
        'A stronger dollar tends to tighten global liquidity, which has often coincided with weaker risk assets, crypto included.',
        'The index strip on the home page and the Compare VS chart let you line up DXY with any coin.',
      ],
      ko: [
        '달러 인덱스(DXY)는 주요 통화 바스켓 대비 달러 가치를 나타냅니다.',
        '달러가 강해지면 전 세계 유동성이 줄어드는 경향이 있고, 이는 암호화폐를 포함한 위험자산 약세와 함께 나타나는 경우가 많았습니다.',
        '홈의 지수 스트립과 비교 차트에서 DXY를 원하는 코인과 나란히 볼 수 있습니다.',
      ],
    },
  },
];

// 글마다 직접 만든 그라데이션 썸네일과 해시태그
const THUMBS: Record<string, { from: string; to: string; symbol: string }> = {
  'open-interest': { from: '#3182f6', to: '#1b64da', symbol: 'OI' },
  'kimchi-premium': { from: '#f04452', to: '#ff8a3d', symbol: '₩' },
  'long-short-ratio': { from: '#26a69a', to: '#2f80ed', symbol: 'L / S' },
  'gold-and-bitcoin': { from: '#f2c94c', to: '#f7931a', symbol: 'Au · ₿' },
  'dollar-index': { from: '#2c3e50', to: '#4ca1af', symbol: '$' },
};

const TAGS: Record<string, string[]> = {
  'open-interest': ['#OI', '#Derivatives'],
  'kimchi-premium': ['#KRW', '#Premium'],
  'long-short-ratio': ['#LongShort', '#Sentiment'],
  'gold-and-bitcoin': ['#Gold', '#BTC'],
  'dollar-index': ['#DXY', '#Macro'],
};

export const Blog: React.FC = () => {
  const { t, lang } = useI18n();
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const posts = POSTS.filter(p => (cat === 'all' || p.category === cat)
    && (!q || p.title[lang].toLowerCase().includes(q) || p.body[lang].some(b => b.toLowerCase().includes(q))));
  const pill = (active: boolean) => ({
    borderRadius: 99, px: 1.8, py: 0.4, fontSize: 12, fontWeight: 700, minWidth: 0,
    bgcolor: active ? 'primary.main' : 'ui.pill.bg', color: active ? '#fff' : 'ui.pill.fg', '&:hover': { bgcolor: active ? 'primary.dark' : 'ui.pill.hover' },
  });
  return (
    <>
      <Typography sx={{ fontSize: 24, fontWeight: 800, mb: 2 }}>{t('blog.title')}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1.5} sx={{ mb: 3 }}>
        {/* 카테고리 버튼은 화면 폭과 관계없이 한 줄로 나란히 둔다 */}
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button sx={pill(cat === 'all')} onClick={() => setCat('all')}>{t('blog.all')}</Button>
          {CATEGORIES.map(c => <Button key={c} sx={pill(cat === c)} onClick={() => setCat(c)}>{t(`blog.cat.${c}` as TKey)}</Button>)}
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ border: 1, borderColor: 'text.secondary', borderRadius: 99, px: 1.5, py: 0.2, display: 'flex', alignItems: 'center', width: { sm: 220 } }}>
          <InputBase value={query} onChange={e => setQuery(e.target.value)} placeholder={t('cards.search')} sx={{ flexGrow: 1, fontSize: 12 }} />
          <span style={{ fontSize: 12 }}>🔍</span>
        </Box>
      </Stack>
      {posts.length === 0 && <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>{t('search.empty')}</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, columnGap: 2.5, rowGap: 4 }}>
        {posts.map(p => {
          const th = THUMBS[p.slug];
          return (
            <Box key={p.slug} component={RouterLink} to={`/blog/${p.slug}`}
              sx={{ minWidth: 0, textDecoration: 'none', color: 'inherit', pb: 3, borderBottom: 1, borderColor: 'divider', '&:hover .thumb': { transform: 'scale(1.03)' } }}>
              {/* 직접 만든 그라데이션 썸네일 */}
              <Box sx={{ borderRadius: 2, overflow: 'hidden', mb: 2, aspectRatio: '16 / 11' }}>
                <Box className="thumb" sx={{
                  width: '100%', height: '100%', transition: 'transform .3s',
                  background: `linear-gradient(135deg, ${th?.from ?? '#3182f6'}, ${th?.to ?? '#1b64da'})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.92)', fontSize: 44, fontWeight: 800, letterSpacing: -1,
                }}>
                  {th?.symbol ?? '◆'}
                </Box>
              </Box>
              <Typography sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{p.title[lang]}</Typography>
              <Typography noWrap sx={{ fontSize: 13, color: 'text.secondary', mt: 1 }}>{p.body[lang][0]}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary', textAlign: 'right', mt: 1 }}>
                {(TAGS[p.slug] ?? [`#${p.tag}`]).join(' ')}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1.5 }}>{p.date}</Typography>
            </Box>
          );
        })}
      </Box>
    </>
  );
};

/** 글마다 본문 끝에 붙는 관련 화면 바로가기 */
const POST_LINKS: Record<string, { to: string; key: string }> = {
  'open-interest': { to: '/compare', key: 'oi' },
  'kimchi-premium': { to: '/#monitor', key: 'kimp' },
  'long-short-ratio': { to: '/longs-shorts', key: 'ls' },
  'gold-and-bitcoin': { to: '/correlation', key: 'gold' },
  'dollar-index': { to: '/compare', key: 'dxy' },
};

/** 읽는 시간(분): 한국어 약 500자, 영어 약 200단어에 1분 */
const readMinutes = (texts: string[], lang: Lang) => {
  const all = texts.join(' ');
  return Math.max(1, Math.round(lang === 'ko' ? all.replace(/\s/g, '').length / 500 : all.split(/\s+/).length / 200));
};

const UP_C = '#0c8f60';
const DOWN_C = '#d63c42';

export const BlogPost: React.FC = () => {
  const { slug } = useParams();
  const { t, lang } = useI18n();
  const post = POSTS.find(p => p.slug === slug);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // 읽은 만큼 위쪽 막대를 채운다
  useEffect(() => {
    const onScroll = () => {
      const d = document.documentElement;
      const max = d.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer.current); };
  }, [slug]);

  if (!post) return <PageHeader title="404" />;
  const blocks: Block[] = post.blocks?.[lang] ?? post.body[lang].map(text => ({ type: 'p' as const, text }));
  const minutes = readMinutes(post.body[lang], lang);
  const link = POST_LINKS[post.slug];

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch { /* 클립보드 권한 없음 */ }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  const pillBtn = {
    height: 38, px: 2, borderRadius: 99, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  } as const;
  let firstP = true;

  return (
    <>
      {/* 읽기 진행 막대 (헤더 바로 아래) */}
      <Box sx={{ position: 'sticky', top: 92, zIndex: 19, height: 3, width: '100vw', ml: 'calc(50% - 50vw)', mt: { xs: -2, sm: -3 } }}>
        <Box sx={{ height: 3, width: `${(progress * 100).toFixed(1)}%`, bgcolor: 'primary.main', borderRadius: '0 2px 2px 0', transition: 'width .1s' }} />
      </Box>
      <Stack sx={{ maxWidth: 760, mx: 'auto', px: { sm: 2 }, pt: { xs: 3, md: 6 }, pb: 8 }}>
        <Box component={RouterLink} to="/blog" sx={{
          alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 1, height: 34, pl: 1.25, pr: 1.75, borderRadius: 99,
          bgcolor: 'ui.pill.bg', color: 'text.secondary', fontSize: 14, fontWeight: 600, textDecoration: 'none', '&:hover': { color: 'text.primary' },
        }}>← {t('blog.title')}</Box>

        <Stack gap={2.5} sx={{ mt: 5, pb: 4, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Box component="span" sx={{ height: 28, px: 1.5, borderRadius: 99, bgcolor: 'ui.highlight.bg', color: 'ui.highlight.fg', fontSize: 13, fontWeight: 800, letterSpacing: '0.3px', display: 'flex', alignItems: 'center' }}>{post.tag}</Box>
            <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'text.secondary' }}>{post.date}</Typography>
          </Stack>
          <Typography component="h1" sx={{ m: 0, fontSize: { xs: 32, md: 48 }, lineHeight: 1.2, fontWeight: 800, letterSpacing: { xs: '-1px', md: '-1.6px' }, textWrap: 'balance' }}>
            {post.title[lang]}
          </Typography>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <LogoMark size={36} />
            <Stack gap="2px">
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>CoinTracker</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('blog.readTime', { n: String(minutes) })}</Typography>
            </Stack>
            <Box sx={{ flex: 1 }} />
            <Box component="button" type="button" onClick={share} sx={{
              ...pillBtn, border: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary', '&:hover': { bgcolor: 'ui.pill.bg' },
            }}>{copied ? `✓ ${t('blog.copied')}` : t('blog.copyLink')}</Box>
          </Stack>
        </Stack>

        <Stack component="article" gap={3.5} sx={{ pt: 5 }}>
          {blocks.map((b, i) => {
            if (b.type === 'p') {
              // 첫 문단은 크게
              const lead = firstP;
              firstP = false;
              return (
                <Typography key={i} sx={lead
                  ? { fontSize: { xs: 19, md: 21 }, lineHeight: 1.75, fontWeight: 500, letterSpacing: '-0.2px', color: 'text.primary', textWrap: 'pretty' }
                  : { fontSize: { xs: 17, md: 18 }, lineHeight: 1.85, color: 'text.secondary', textWrap: 'pretty' }}>
                  {b.text}
                </Typography>
              );
            }
            if (b.type === 'quote') {
              return (
                <Box key={i} component="blockquote" sx={{
                  m: 0, mt: 1, py: 0.5, pl: 3, borderLeft: '3px solid', borderColor: 'primary.main',
                  fontSize: { xs: 19, md: 22 }, lineHeight: 1.6, fontWeight: 700, letterSpacing: '-0.4px', color: 'text.primary', textWrap: 'pretty',
                }}>{b.text}</Box>
              );
            }
            return (
              <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                {b.items.map((it, j) => {
                  const c = it.tone === 'up' ? UP_C : DOWN_C;
                  return (
                    <Stack key={j} gap={1.75} sx={{ px: 2.75, py: 2.5, borderRadius: '16px', bgcolor: `${c}17` }}>
                      <Stack direction="row" gap={1}>
                        {it.tags.map(tag => (
                          <Box key={tag} component="span" sx={{ height: 30, px: 1.5, borderRadius: 2, bgcolor: 'background.paper', color: c, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center' }}>{tag}</Box>
                        ))}
                      </Stack>
                      <Typography sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.45 }}>{it.text}</Typography>
                    </Stack>
                  );
                })}
              </Box>
            );
          })}

          {/* 관련 화면 바로가기 */}
          {link && (
            <Box component={RouterLink} to={link.to} sx={{
              display: 'flex', alignItems: 'center', gap: 2.25, mt: 1.5, px: 3, py: 2.75, borderRadius: '18px', border: 1, borderColor: 'divider',
              bgcolor: 'ui.pill.bg', color: 'text.primary', textDecoration: 'none', transition: 'border-color .15s', '&:hover': { borderColor: 'primary.main' },
            }}>
              <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: '14px', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><polyline points="3,16 9,10 13,13 21,5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Box>
              <Stack sx={{ flex: 1, gap: 0.5, minWidth: 0 }}>
                <Typography sx={{ fontSize: 16.5, fontWeight: 800 }}>{t(`blog.link.${link.key}` as TKey)}</Typography>
                <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t(`blog.link.${link.key}.desc` as TKey)}</Typography>
              </Stack>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'primary.main' }}>→</Typography>
            </Box>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mt: 7, pt: 3, borderTop: 1, borderColor: 'divider' }}>
          <Box component={RouterLink} to="/blog" sx={{ fontSize: 15, fontWeight: 700, color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'text.primary' } }}>← {t('blog.backToList')}</Box>
          <Box sx={{ flex: 1 }} />
          <Box component="button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} sx={{ ...pillBtn, border: 0, bgcolor: 'ui.pill.bg', color: 'text.secondary' }}>
            ↑ {t('blog.toTop')}
          </Box>
        </Stack>
      </Stack>

      {copied && (
        <Box role="status" sx={{
          position: 'fixed', left: '50%', bottom: 36, transform: 'translateX(-50%)', zIndex: 1300, height: 46, px: 2.5, borderRadius: 99,
          bgcolor: 'rgba(18,21,26,0.92)', color: '#fff', fontSize: 14.5, fontWeight: 600, display: 'flex', alignItems: 'center',
        }}>{t('blog.linkCopied')}</Box>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// 소개 (소개 글 + 직접 그린 일러스트 + 문의 양식)
// ---------------------------------------------------------------------------
const CONTACT_EMAIL = 'ckdqja13580@gmail.com';

const ABOUT_TEXT: Record<Lang, { heading: string; paragraphs: string[] }> = {
  en: {
    heading: 'About Coin Tracker',
    paragraphs: [
      'Coin Tracker collects public market data from Korean and global exchanges and shows it as charts you can read at a glance.',
      'Compare a coin with derivatives, indices and commodities, watch intraday impulses across exchanges with the Coin Impulse Monitor, and follow large trades in real time.',
      'It is a personal project. All data is for information only and is not investment advice.',
    ],
  },
  ko: {
    heading: 'Coin Tracker 소개',
    paragraphs: [
      'Coin Tracker는 국내외 거래소의 공개 시장 데이터를 모아 한눈에 읽기 쉬운 차트로 보여줍니다.',
      '코인을 파생 지표·지수·원자재와 비교하고, Coin Impulse Monitor로 거래소별 당일 등락을 함께 보며, 대규모 체결을 실시간으로 확인할 수 있습니다.',
      '개인 프로젝트이며, 모든 데이터는 참고용으로 투자 권유가 아닙니다.',
    ],
  },
};

/** 노트북 화면 위 상승 차트 일러스트 (직접 그린 SVG) */
const AboutIllustration: React.FC = () => (
  <Box component="svg" viewBox="0 0 320 220" sx={{ width: '100%', maxWidth: 320 }} aria-hidden>
    <defs>
      <linearGradient id="about-screen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e8f3ff" />
        <stop offset="1" stopColor="#c9e2ff" />
      </linearGradient>
    </defs>
    <ellipse cx="160" cy="196" rx="130" ry="12" fill="#3182f6" opacity="0.08" />
    <rect x="58" y="34" width="204" height="132" rx="12" fill="#191f28" />
    <rect x="68" y="44" width="184" height="112" rx="6" fill="url(#about-screen)" />
    <polyline points="80,136 108,118 132,126 158,96 184,104 210,74 240,62" fill="none" stroke="#3182f6" strokeWidth="5"
      strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="240" cy="62" r="7" fill="#fff" stroke="#3182f6" strokeWidth="4" />
    <path d="M40 166 h240 l-14 18 H54 z" fill="#333d4b" />
    <circle cx="40" cy="70" r="20" fill="#f7931a" />
    <text x="40" y="77" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">₿</text>
    <circle cx="286" cy="118" r="15" fill="#627eea" />
    <text x="286" y="124" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">Ξ</text>
  </Box>
);

export const About: React.FC = () => {
  const { t, lang } = useI18n();
  const { hash } = useLocation();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  const text = ABOUT_TEXT[lang];
  const required = ['name', 'email', 'subject', 'message'] as const;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const valid = required.every(k => form[k].trim()) && emailOk;

  // 메일을 받을 서버가 없으므로, 입력 내용으로 메일 앱을 연다
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    const body = `${form.message}\n\n---\n${form.name} <${form.email}>`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(body)}`;
  };

  const field = (key: keyof typeof form, label: string, multiline = false) => {
    const empty = tried && !form[key].trim();
    const badEmail = key === 'email' && tried && !!form.email && !emailOk;
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 0.5, sm: 2 }} alignItems={{ sm: multiline ? 'flex-start' : 'center' }} sx={{ mb: 1.5 }}>
        <Typography component="label" htmlFor={`contact-${key}`}
          sx={{ width: { sm: 120 }, flexShrink: 0, textAlign: { sm: 'right' }, fontWeight: 700, fontSize: 14, color: 'text.secondary', pt: { sm: multiline ? 1 : 0 } }}>
          {label}*
        </Typography>
        <Box sx={{ flexGrow: 1 }}>
          <InputBase id={`contact-${key}`} value={form[key]} multiline={multiline} minRows={multiline ? 6 : undefined}
            type={key === 'email' ? 'email' : 'text'}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            sx={{
              width: '100%', bgcolor: 'ui.pill.bg', borderRadius: 2, px: 1.5, py: 1, fontSize: 14,
              border: 1, borderColor: empty || badEmail ? 'error.main' : 'transparent',
            }} />
          {(empty || badEmail) && (
            <Typography sx={{ color: 'error.main', fontSize: 12, mt: 0.5 }}>
              {badEmail ? t('about.form.badEmail') : t('about.form.required')}
            </Typography>
          )}
        </Box>
      </Stack>
    );
  };

  return (
    <Box>
      <Typography sx={{ fontSize: 24, fontWeight: 800, mb: 3 }}>{t('about.title')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 4, alignItems: 'center', mb: 6 }}>
        <Box>
          <Typography sx={{ fontSize: 17, fontWeight: 800, mb: 1.5 }}>{text.heading}</Typography>
          {text.paragraphs.map((para, i) => (
            <Typography key={i} sx={{ fontSize: 14, lineHeight: 1.8, color: 'text.secondary', mb: 1 }}>{para}</Typography>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}><AboutIllustration /></Box>
      </Box>

      <Box id="contact" sx={{ scrollMarginTop: 120 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, mb: 1 }}>{t('about.contact')}</Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 3 }}>{t('about.contactBody')}</Typography>
        <Box component="form" noValidate onSubmit={send} sx={{ maxWidth: 900 }}>
          {field('name', t('about.form.name'))}
          {field('email', t('about.form.email'))}
          {field('subject', t('about.form.subject'))}
          {field('message', t('about.form.message'), true)}
          <Stack direction="row" alignItems="center" gap={2} sx={{ ml: { sm: '136px' }, mt: 2 }}>
            <Button type="submit" variant="contained" disableElevation sx={{ borderRadius: 99, px: 5, fontWeight: 700 }}>{t('about.form.send')}</Button>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {t('about.form.note')} <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// 개인정보 처리방침 (이 사이트가 실제로 동작하는 방식 기준으로 작성)
// ---------------------------------------------------------------------------
const POLICY: Record<Lang, { updated: string; intro: string; sections: { title: string; items: string[] }[] }> = {
  en: {
    updated: 'Last updated: 2026-10-12',
    intro: 'This policy explains what information Coin Tracker handles and how. Coin Tracker has no sign-up and does not run ads.',
    sections: [
      { title: 'Information we collect', items: [
        'We do not ask for your name, email or any account information to use the site.',
        'If you contact us, we receive the name, email address and message you choose to send by email.',
      ] },
      { title: 'Data stored in your browser', items: [
        'Settings such as language, light/dark theme, selected coins, base exchange, saved charts, favorites and whether you closed the storage notice are kept in your browser (localStorage).',
        'This data never leaves your device and is not sent to our server. You can delete it at any time by clearing site data in your browser.',
      ] },
      { title: 'Data our server handles', items: [
        'Our server requests public market data from exchanges and data providers on your behalf and caches it for a short time.',
        'Error logs may record the time and the failing request to external services. They do not include personal information.',
      ] },
      { title: 'Third-party services', items: [
        'Real-time trades on the Longs / Shorts page are received by your browser directly from exchange servers (Binance, Bybit, OKX, Bitget). These providers can see your IP address under their own policies.',
        'Charts and the economic calendar use TradingView embedded widgets, which may set their own cookies.',
        'Market data comes from public APIs of Upbit, Bithumb, Coinone, Korbit, Gate, Binance, Bybit, OKX, Yahoo Finance, CoinGecko, alternative.me and mempool.space.',
      ] },
      { title: 'Changes to this policy', items: [
        'If this policy changes, we will update this page and the date at the top.',
      ] },
      { title: 'Contact', items: [
        `Questions about this policy can be sent to ${CONTACT_EMAIL}.`,
      ] },
    ],
  },
  ko: {
    updated: '최종 수정일: 2026-10-12',
    intro: '이 방침은 Coin Tracker가 어떤 정보를 어떻게 다루는지 설명합니다. Coin Tracker는 회원가입이 없고 광고를 싣지 않습니다.',
    sections: [
      { title: '수집하는 정보', items: [
        '사이트를 이용하는 데 이름, 이메일, 계정 정보를 요구하지 않습니다.',
        '문의를 보내시는 경우, 직접 보내신 이름·이메일 주소·내용을 이메일로 받습니다.',
      ] },
      { title: '브라우저에 저장되는 정보', items: [
        '언어, 라이트/다크 테마, 선택한 코인, 기준 거래소, 저장한 차트, 즐겨찾기, 저장 안내 확인 여부 같은 설정은 브라우저(localStorage)에 저장됩니다.',
        '이 정보는 사용자 기기 밖으로 나가지 않고 우리 서버로 보내지 않습니다. 브라우저에서 사이트 데이터를 삭제하면 언제든 지울 수 있습니다.',
      ] },
      { title: '서버가 처리하는 정보', items: [
        '우리 서버는 거래소와 데이터 제공처의 공개 시장 데이터를 대신 요청하고, 짧은 시간 동안 캐시합니다.',
        '오류 로그에는 시각과 실패한 외부 요청이 기록될 수 있으며, 개인정보는 포함되지 않습니다.',
      ] },
      { title: '외부 서비스', items: [
        '롱/숏 페이지의 실시간 체결은 브라우저가 거래소 서버(바이낸스, 바이빗, OKX, 비트겟)에서 직접 받습니다. 이 과정에서 각 거래소는 자체 방침에 따라 사용자의 IP 주소를 알 수 있습니다.',
        '차트와 경제 캘린더는 TradingView 임베드 위젯을 사용하며, 위젯이 자체 쿠키를 설정할 수 있습니다.',
        '시장 데이터는 업비트, 빗썸, 코인원, 코빗, 게이트, 바이낸스, 바이빗, OKX, Yahoo Finance, CoinGecko, alternative.me, mempool.space의 공개 API에서 가져옵니다.',
      ] },
      { title: '방침의 변경', items: [
        '이 방침이 바뀌면 이 페이지와 위쪽의 수정일을 갱신합니다.',
      ] },
      { title: '문의', items: [
        `이 방침에 대한 문의는 ${CONTACT_EMAIL} 로 보내 주세요.`,
      ] },
    ],
  },
};

export const Policy: React.FC = () => {
  const { t, lang } = useI18n();
  const doc = POLICY[lang];
  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography sx={{ fontSize: 24, fontWeight: 800, mb: 1 }}>{t('policy.title')}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 3 }}>{doc.updated}</Typography>
      <Typography sx={{ fontSize: 14, lineHeight: 1.8, mb: 4 }}>{doc.intro}</Typography>
      {doc.sections.map(sec => (
        <Box key={sec.title} sx={{ mb: 4 }}>
          <Typography component="h2" sx={{ fontSize: 17, fontWeight: 800, mb: 1.5 }}>{sec.title}</Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {sec.items.map((item, i) => (
              <Typography component="li" key={i} sx={{ fontSize: 14, lineHeight: 1.8, color: 'text.secondary', mb: 0.5 }}>{item}</Typography>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
