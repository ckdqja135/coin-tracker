import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from './lib/chartUtils';

export type Lang = 'en' | 'ko';

const dict = {
  en: {
    'blog.all': 'All', 'blog.cat.crypto': 'Crypto', 'blog.cat.commodity': 'Commodity', 'blog.cat.international': 'International',
    'corr.intro': 'A correlation coefficient ranges from -1 to 1. Values near 1 mean two assets tend to move together, values near -1 mean they tend to move in opposite directions, and values near 0 mean there is little relationship. Calculated from log returns over the selected period.',
    'ls.significant': 'Significant Trades', 'ls.mute': 'Mute', 'ls.unmute': 'Play sound on new trades', 'ls.pause': 'Pause', 'ls.resume': 'Resume', 'ls.settings': 'Minimum trade size', 'ls.minSize': 'Min',
    'compare.reset': 'Reset', 'compare.dateRange': 'Date Range', 'compare.pick': 'Select items from the left menu to compare.', 'compare.csv': 'Download CSV',
    'group.crypto': 'Cryptocurrency', 'group.derivatives': 'Derivatives', 'group.indices': 'Indices', 'group.commodity': 'Commodity',
    'group.mining': 'Mining Information', 'group.trending': 'Trending',
    'cards.all': 'All', 'cards.search': 'Search', 'cards.custom': 'Custom', 'cards.customHelp': 'Show only charts saved with ♥',
    'cards.empty': 'No charts saved yet. Press ♥ on a card to add it.',
    'nav.calendar': 'Calendar', 'search.coins': 'Try to search coins',
    'ticker.change': '24h Change', 'ticker.high': '24h High', 'ticker.low': '24h Low', 'ticker.mcap': 'Market Cap',
    'home.clearAll': 'Clear All', 'home.reload': 'Reload', 'home.listing': 'Listing', 'home.premium': 'Premium',
    'home.currencyToggle': 'Switch USD / KRW',
    'home.listingHelp': 'Shows whether each coin is listed on each exchange and its current price.',
    'home.premiumHelp': 'Price difference of each exchange compared with {ex} (converted to USD).',
    'home.cimHelp': 'Real-time % change of the selected coins since monitoring started (or since Reload) on the base exchange. Spot which coin moves first.',
    'calendar.title': 'Economic Calendar', 'calendar.desc': 'Upcoming macro events that can move the market.',
    'theme.toggle': 'Toggle dark mode',
    'nav.home': 'Home', 'nav.compare': 'Compare VS', 'nav.btc': 'BTC', 'nav.eth': 'ETH', 'nav.markets': 'Markets',
    'nav.longshort': 'Longs/Shorts', 'nav.correlation': 'Correlation', 'nav.blog': 'Blog', 'nav.live': 'Live',
    'nav.about': 'About us', 'nav.policy': 'Privacy Policy', 'nav.contact': 'Contact us',
    'search.placeholder': 'Search markets', 'search.empty': 'No results',
    'footer.company': 'Company', 'footer.service': 'Service', 'footer.disclaimer': 'Market data is provided for information only and is not investment advice.',
    'cookie.text': 'This site stores preferences (language, saved charts) in your browser.', 'cookie.ok': 'OK',
    'common.loading': 'Loading…', 'common.error': 'Failed to load data', 'common.csv': 'CSV', 'common.capture': 'Capture',
    'common.copyLink': 'Copy link', 'common.copied': 'Link copied', 'common.interval': 'Interval', 'common.exchange': 'Exchange',
    'common.ma': 'MA', 'common.scale': 'Scale', 'common.linear': 'Linear', 'common.log': 'Log', 'common.percent': '%',
    'common.save': 'Save', 'common.delete': 'Delete', 'common.myCharts': 'My charts', 'common.none': 'None',
    'common.add': 'Add', 'common.long': 'Long', 'common.short': 'Short', 'common.ratio': 'Ratio',
    'common.metricLimited': 'Derivatives metrics are only available for the last 30 days.',
    'home.title': 'Impulse Monitor', 'home.desc': 'Overlay a coin price with derivatives and premium indicators to spot market impulses.',
    'home.asset': 'Asset', 'home.indicator': 'Indicator', 'home.currency': 'Currency',
    'metric.oi': 'Open Interest (Binance)', 'metric.lsr': 'Long/Short Account Ratio (Binance)', 'metric.top-lsr': 'Top Trader L/S Position Ratio',
    'metric.taker': 'Taker Buy/Sell Ratio', 'metric.funding': 'Funding Rate (%)', 'metric.premium-upbit': 'Kimchi Premium – Upbit (%)',
    'metric.premium-bithumb': 'Kimchi Premium – Bithumb (%)', 'metric.volume': 'Volume',
    'coin.price': 'Price', 'coin.change': '24h Change', 'coin.high': '24h High', 'coin.low': '24h Low', 'coin.volume': '24h Volume',
    'coin.oi': 'Open Interest', 'coin.funding': 'Funding Rate', 'coin.nextFunding': 'Next funding', 'coin.lsr': 'Long/Short Ratio',
    'coin.krw': 'KRW Price', 'coin.premium': 'Kimchi Premium', 'coin.fx': 'USD/KRW',
    'markets.title': 'Markets', 'markets.desc': 'Crypto, indices and commodities in one chart.',
    'markets.crypto': 'Cryptocurrency', 'markets.indices': 'Indices', 'markets.commodity': 'Commodity', 'markets.fx': 'FX',
    'markets.favorite': 'Add to my list', 'markets.unfavorite': 'Remove from my list',
    'compare.title': 'Compare VS', 'compare.desc': 'Compare up to 6 assets on the same chart.', 'compare.addAsset': 'Add asset',
    'compare.saveAs': 'Save current chart', 'compare.max': 'You can compare up to 6 assets.',
    'ls.title': 'Longs / Shorts', 'ls.desc': 'Account long/short ratios by exchange and large trades in real time.',
    'ls.ratioHistory': 'Long/Short ratio history', 'ls.current': 'Current ratio by exchange', 'ls.whales': 'Large trades (Binance Futures)',
    'ls.filter.base': 'Base $100K+', 'ls.filter.significant': 'Significant $1M+', 'ls.filter.huge': 'Huge $10M+',
    'ls.col.side': 'Side', 'ls.col.price': 'Price', 'ls.col.size': 'Size', 'ls.col.qty': 'Qty', 'ls.col.age': 'Age',
    'ls.liquidation': 'Liquidation', 'ls.trade': 'Trade', 'ls.showLiq': 'Liquidations', 'ls.showTrades': 'Trades',
    'ls.waiting': 'Waiting for trades…', 'ls.connected': 'Live', 'ls.disconnected': 'Reconnecting…',
    'corr.title': 'Correlation', 'corr.desc': 'Pearson correlation of log returns between assets.',
    'corr.coef': 'Correlation coefficient', 'corr.vs': '{asset} VS', 'corr.heatmap': 'Triangle correlation heatmap',
    'corr.note': 'Close to +1: move together · close to −1: move opposite · around 0: unrelated.',
    'blog.title': 'Blog', 'blog.desc': 'Notes on how to read the indicators on this site.',
    'about.title': 'About us', 'about.body': 'Coin Tracker is a personal project that gathers public market data from several exchanges and turns it into easy-to-read charts.',
    'about.contact': 'Contact', 'about.contactBody': 'Questions or suggestions? Reach out by email.',
    'policy.title': 'Privacy Policy',
    'policy.body': 'Coin Tracker does not require an account and does not collect personal information on its servers. Preferences such as language and saved charts are stored only in your browser (localStorage) and can be removed by clearing site data.',
  },
  ko: {
    'blog.all': '전체', 'blog.cat.crypto': '암호화폐', 'blog.cat.commodity': '원자재', 'blog.cat.international': '해외',
    'corr.intro': '상관계수는 -1부터 1 사이의 값입니다. 1에 가까울수록 두 자산이 같은 방향으로, -1에 가까울수록 반대 방향으로 움직이는 경향이 있으며, 0에 가까우면 관계가 거의 없다는 뜻입니다. 선택한 기간의 로그 수익률로 계산합니다.',
    'ls.significant': '주요 체결', 'ls.mute': '소리 끄기', 'ls.unmute': '새 체결 알림음 켜기', 'ls.pause': '일시정지', 'ls.resume': '다시 시작', 'ls.settings': '최소 체결 규모', 'ls.minSize': '최소',
    'compare.reset': '초기화', 'compare.dateRange': '기간 지정', 'compare.pick': '왼쪽 메뉴에서 비교할 항목을 선택하세요.', 'compare.csv': 'CSV 다운로드',
    'group.crypto': '암호화폐', 'group.derivatives': '파생상품', 'group.indices': '지수', 'group.commodity': '원자재',
    'group.mining': '채굴 정보', 'group.trending': '트렌드',
    'cards.all': '전체', 'cards.search': '검색', 'cards.custom': '내 차트', 'cards.customHelp': '♥로 저장한 차트만 보기',
    'cards.empty': '저장한 차트가 없습니다. 카드의 ♥를 눌러 추가하세요.',
    'nav.calendar': '캘린더', 'search.coins': '코인을 검색해 보세요',
    'ticker.change': '24시간 변동', 'ticker.high': '24시간 고가', 'ticker.low': '24시간 저가', 'ticker.mcap': '시가총액',
    'home.clearAll': '전체 삭제', 'home.reload': '새로고침', 'home.listing': '상장', 'home.premium': '프리미엄',
    'home.currencyToggle': 'USD / KRW 전환',
    'home.listingHelp': '거래소별 상장 여부와 현재가를 보여줍니다.',
    'home.premiumHelp': '{ex} 대비 각 거래소의 가격 차이입니다 (USD 환산).',
    'home.cimHelp': '기준 거래소에서 모니터링 시작(또는 새로고침) 시점 대비 선택한 코인들의 실시간 등락률입니다. 어떤 코인이 먼저 움직이는지 확인하세요.',
    'calendar.title': '경제 캘린더', 'calendar.desc': '시장에 영향을 줄 수 있는 주요 경제 일정입니다.',
    'theme.toggle': '다크 모드 전환',
    'nav.home': '홈', 'nav.compare': '비교 차트', 'nav.btc': 'BTC', 'nav.eth': 'ETH', 'nav.markets': '마켓',
    'nav.longshort': '롱/숏', 'nav.correlation': '상관관계', 'nav.blog': '블로그', 'nav.live': '실시간',
    'nav.about': '소개', 'nav.policy': '개인정보 처리방침', 'nav.contact': '문의하기',
    'search.placeholder': '마켓 검색', 'search.empty': '검색 결과 없음',
    'footer.company': '회사', 'footer.service': '서비스', 'footer.disclaimer': '모든 시장 데이터는 참고용이며 투자 권유가 아닙니다.',
    'cookie.text': '이 사이트는 언어, 저장한 차트 등의 설정을 브라우저에 저장합니다.', 'cookie.ok': '확인',
    'common.loading': '불러오는 중…', 'common.error': '데이터를 불러오지 못했습니다', 'common.csv': 'CSV', 'common.capture': '캡처',
    'common.copyLink': '링크 복사', 'common.copied': '링크가 복사되었습니다', 'common.interval': '봉 단위', 'common.exchange': '거래소',
    'common.ma': '이동평균', 'common.scale': '스케일', 'common.linear': '선형', 'common.log': '로그', 'common.percent': '%',
    'common.save': '저장', 'common.delete': '삭제', 'common.myCharts': '내 차트', 'common.none': '없음',
    'common.add': '추가', 'common.long': '롱', 'common.short': '숏', 'common.ratio': '비율',
    'common.metricLimited': '파생 지표는 최근 30일 데이터만 제공됩니다.',
    'home.title': '임펄스 모니터', 'home.desc': '코인 가격과 파생·프리미엄 지표를 겹쳐 보며 시장의 움직임을 포착하세요.',
    'home.asset': '자산', 'home.indicator': '지표', 'home.currency': '통화',
    'metric.oi': '미결제약정 (바이낸스)', 'metric.lsr': '롱/숏 계정 비율 (바이낸스)', 'metric.top-lsr': '상위 트레이더 롱/숏 포지션 비율',
    'metric.taker': '테이커 매수/매도 비율', 'metric.funding': '펀딩비 (%)', 'metric.premium-upbit': '김치 프리미엄 – 업비트 (%)',
    'metric.premium-bithumb': '김치 프리미엄 – 빗썸 (%)', 'metric.volume': '거래량',
    'coin.price': '가격', 'coin.change': '24시간 변동', 'coin.high': '24시간 고가', 'coin.low': '24시간 저가', 'coin.volume': '24시간 거래대금',
    'coin.oi': '미결제약정', 'coin.funding': '펀딩비', 'coin.nextFunding': '다음 펀딩', 'coin.lsr': '롱/숏 비율',
    'coin.krw': '원화 가격', 'coin.premium': '김치 프리미엄', 'coin.fx': '원/달러 환율',
    'markets.title': '마켓', 'markets.desc': '암호화폐, 지수, 원자재를 한 차트에서 확인하세요.',
    'markets.crypto': '암호화폐', 'markets.indices': '지수', 'markets.commodity': '원자재', 'markets.fx': '환율',
    'markets.favorite': '내 목록에 추가', 'markets.unfavorite': '내 목록에서 제거',
    'compare.title': '비교 차트', 'compare.desc': '최대 6개 자산을 한 차트에서 비교하세요.', 'compare.addAsset': '자산 추가',
    'compare.saveAs': '현재 차트 저장', 'compare.max': '최대 6개까지 비교할 수 있습니다.',
    'ls.title': '롱 / 숏', 'ls.desc': '거래소별 롱/숏 계정 비율과 대규모 체결을 실시간으로 확인하세요.',
    'ls.ratioHistory': '롱/숏 비율 추이', 'ls.current': '거래소별 현재 비율', 'ls.whales': '대규모 체결 (바이낸스 선물)',
    'ls.filter.base': '기본 $10만+', 'ls.filter.significant': '주요 $100만+', 'ls.filter.huge': '초대형 $1000만+',
    'ls.col.side': '구분', 'ls.col.price': '가격', 'ls.col.size': '규모', 'ls.col.qty': '수량', 'ls.col.age': '경과',
    'ls.liquidation': '청산', 'ls.trade': '체결', 'ls.showLiq': '청산', 'ls.showTrades': '체결',
    'ls.waiting': '체결 대기 중…', 'ls.connected': '실시간', 'ls.disconnected': '재연결 중…',
    'corr.title': '상관관계', 'corr.desc': '자산 간 로그 수익률의 피어슨 상관계수입니다.',
    'corr.coef': '상관계수', 'corr.vs': '{asset} VS', 'corr.heatmap': '삼각 상관관계 히트맵',
    'corr.note': '+1에 가까울수록 같은 방향, −1에 가까울수록 반대 방향, 0 근처는 무관하게 움직입니다.',
    'blog.title': '블로그', 'blog.desc': '이 사이트의 지표를 읽는 방법을 정리했습니다.',
    'about.title': '소개', 'about.body': 'Coin Tracker는 여러 거래소의 공개 시장 데이터를 모아 보기 쉬운 차트로 보여주는 개인 프로젝트입니다.',
    'about.contact': '문의', 'about.contactBody': '질문이나 제안이 있다면 이메일로 연락 주세요.',
    'policy.title': '개인정보 처리방침',
    'policy.body': 'Coin Tracker는 회원가입이 없으며 서버에 개인정보를 수집하지 않습니다. 언어, 저장한 차트 등의 설정은 브라우저(localStorage)에만 저장되며 사이트 데이터를 삭제하면 지워집니다.',
  },
} as const;

export type TKey = keyof typeof dict.en;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nValue>({ lang: 'ko', setLang: () => {}, t: k => k });

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => storage.get<Lang>('lang', navigator.language.startsWith('ko') ? 'ko' : 'en'));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    storage.set('lang', l);
  };

  const t = (key: TKey, vars?: Record<string, string>) => {
    let s: string = dict[lang][key] ?? dict.en[key] ?? key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, v); });
    return s;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
