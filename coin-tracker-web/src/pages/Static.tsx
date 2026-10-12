import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { Box, Button, Card, CardActionArea, CardContent, Chip, InputBase, Link, Stack, Typography } from '@mui/material';
import { PageHeader, Panel } from '../components/Panel';
import { useI18n, Lang, TKey } from '../i18n';

type Category = 'crypto' | 'commodity' | 'international';
const CATEGORIES: Category[] = ['crypto', 'commodity', 'international'];

interface Post {
  slug: string;
  date: string;
  tag: string;
  category: Category;
  title: Record<Lang, string>;
  body: Record<Lang, string[]>;
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

export const Blog: React.FC = () => {
  const { t, lang } = useI18n();
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const posts = POSTS.filter(p => (cat === 'all' || p.category === cat)
    && (!q || p.title[lang].toLowerCase().includes(q) || p.body[lang].some(b => b.toLowerCase().includes(q))));
  const pill = (active: boolean) => ({
    borderRadius: 99, px: 1.8, py: 0.4, fontSize: 12, fontWeight: 700, minWidth: 0,
    bgcolor: active ? '#3d6cf4' : '#23262d', color: '#fff', '&:hover': { bgcolor: active ? '#3159d6' : '#33363d' },
  });
  return (
    <>
      <Typography sx={{ fontSize: 24, fontWeight: 800, mb: 2 }}>{t('blog.title')}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1} sx={{ mb: 3 }}>
        <Button sx={pill(cat === 'all')} onClick={() => setCat('all')}>{t('blog.all')}</Button>
        {CATEGORIES.map(c => <Button key={c} sx={pill(cat === c)} onClick={() => setCat(c)}>{t(`blog.cat.${c}` as TKey)}</Button>)}
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ border: 1, borderColor: 'text.secondary', borderRadius: 99, px: 1.5, py: 0.2, display: 'flex', alignItems: 'center', width: { sm: 220 } }}>
          <InputBase value={query} onChange={e => setQuery(e.target.value)} placeholder={t('cards.search')} sx={{ flexGrow: 1, fontSize: 12 }} />
          <span style={{ fontSize: 12 }}>🔍</span>
        </Box>
      </Stack>
      {posts.length === 0 && <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>{t('search.empty')}</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {posts.map(p => (
          <Card key={p.slug} variant="outlined">
            <CardActionArea component={RouterLink} to={`/blog/${p.slug}`} sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1 }}>
                  <Chip size="small" label={p.tag} />
                  <Typography variant="caption" color="text.secondary">{p.date}</Typography>
                </Stack>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{p.title[lang]}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{p.body[lang][0]}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </>
  );
};

export const BlogPost: React.FC = () => {
  const { slug } = useParams();
  const { t, lang } = useI18n();
  const post = POSTS.find(p => p.slug === slug);
  if (!post) return <PageHeader title="404" />;
  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Link component={RouterLink} to="/blog" underline="hover" color="text.secondary">← {t('blog.title')}</Link>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>{post.date} · {post.tag}</Typography>
      <PageHeader title={post.title[lang]} />
      {post.body[lang].map((para, i) => <Typography key={i} sx={{ mb: 2, lineHeight: 1.8 }}>{para}</Typography>)}
    </Box>
  );
};

export const About: React.FC = () => {
  const { t } = useI18n();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);
  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <PageHeader title={t('about.title')} />
      <Panel><Typography sx={{ lineHeight: 1.8 }}>{t('about.body')}</Typography></Panel>
      <Box id="contact">
        <Panel title={t('about.contact')}>
          <Typography sx={{ mb: 1 }}>{t('about.contactBody')}</Typography>
          <Link href="mailto:ckdqja13580@gmail.com">ckdqja13580@gmail.com</Link>
        </Panel>
      </Box>
    </Box>
  );
};

export const Policy: React.FC = () => {
  const { t } = useI18n();
  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <PageHeader title={t('policy.title')} />
      <Panel><Typography sx={{ lineHeight: 1.8 }}>{t('policy.body')}</Typography></Panel>
    </Box>
  );
};
