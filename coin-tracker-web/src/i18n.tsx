import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from './lib/chartUtils';

export type Lang = 'en' | 'ko';

const dict = {
  en: {
    'ls.collecting': 'Collecting · {min} min so far', 'ls.account': 'Account L/S', 'ls.accountHelp': 'Share of accounts holding long vs short positions, published by the exchange (5-minute data).',
    'about.form.name': 'Name', 'about.form.email': 'Email', 'about.form.subject': 'Subject', 'about.form.message': 'Message', 'about.form.send': 'Send',
    'about.form.required': 'Please fill in this field.', 'about.form.badEmail': 'Please enter a valid email address.', 'about.form.note': 'Opens your mail app with this message. You can also write to',
    'compare.myCharts': 'My charts', 'compare.myChart': 'My Chart', 'compare.noSaved': 'No saved charts',
    'cards.menu': 'Categories',
    'footer.language': 'Language',
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
    'nav.compare': 'Compare VS', 'nav.btc': 'BTC', 'nav.eth': 'ETH', 'nav.markets': 'Markets',
    'nav.longshort': 'Longs/Shorts', 'nav.correlation': 'Correlation', 'nav.blog': 'Blog',
    'nav.about': 'About us', 'nav.policy': 'Privacy Policy', 'nav.contact': 'Contact us',
    'search.empty': 'No results',
    'footer.company': 'Company', 'footer.service': 'Service', 'footer.disclaimer': 'Market data is provided for information only and is not investment advice.',
    'cookie.text': 'This site stores preferences (language, saved charts) in your browser.', 'cookie.ok': 'OK',
    'common.capture': 'Capture',
    'common.copied': 'Link copied', 
    'common.delete': 'Delete', 
    
    
    
    
    
    'markets.title': 'Markets', 
    
    'compare.title': 'Compare VS', 
    'compare.saveAs': 'Save current chart', 
    'ls.title': 'Longs / Shorts', 
    
    
    'ls.waiting': 'Waiting for trades…', 'ls.disconnected': 'Reconnecting…',
    'corr.coef': 'Correlation coefficient', 'corr.vs': '{asset} VS', 'corr.heatmap': 'Triangle correlation heatmap',
    'blog.title': 'Blog', 
    'about.title': 'About us', 
    'about.contact': 'Contact', 'about.contactBody': 'Questions or suggestions? Fill out the form below and we will get back to you.',
    'policy.title': 'Privacy Policy',
  },
  ko: {
    'ls.collecting': '수집 중 · {min}분째', 'ls.account': '계정 롱/숏', 'ls.accountHelp': '거래소가 공개하는, 롱·숏 포지션을 가진 계정의 비중입니다 (5분 단위 데이터).',
    'about.form.name': '이름', 'about.form.email': '이메일', 'about.form.subject': '제목', 'about.form.message': '문의 내용', 'about.form.send': '보내기',
    'about.form.required': '이 항목을 입력해 주세요.', 'about.form.badEmail': '올바른 이메일 주소를 입력해 주세요.', 'about.form.note': '입력한 내용으로 메일 앱이 열립니다. 직접 보내셔도 됩니다:',
    'compare.myCharts': '내 차트', 'compare.myChart': '내 차트', 'compare.noSaved': '저장한 차트가 없습니다',
    'cards.menu': '카테고리',
    'footer.language': '언어',
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
    'nav.compare': '비교 차트', 'nav.btc': 'BTC', 'nav.eth': 'ETH', 'nav.markets': '마켓',
    'nav.longshort': '롱/숏', 'nav.correlation': '상관관계', 'nav.blog': '블로그',
    'nav.about': '소개', 'nav.policy': '개인정보 처리방침', 'nav.contact': '문의하기',
    'search.empty': '검색 결과 없음',
    'footer.company': '회사', 'footer.service': '서비스', 'footer.disclaimer': '모든 시장 데이터는 참고용이며 투자 권유가 아닙니다.',
    'cookie.text': '이 사이트는 언어, 저장한 차트 등의 설정을 브라우저에 저장합니다.', 'cookie.ok': '확인',
    'common.capture': '캡처',
    'common.copied': '링크가 복사되었습니다', 
    'common.delete': '삭제', 
    
    
    
    
    
    'markets.title': '마켓', 
    
    'compare.title': '비교 차트', 
    'compare.saveAs': '현재 차트 저장', 
    'ls.title': '롱 / 숏', 
    
    
    'ls.waiting': '체결 대기 중…', 'ls.disconnected': '재연결 중…',
    'corr.coef': '상관계수', 'corr.vs': '{asset} VS', 'corr.heatmap': '삼각 상관관계 히트맵',
    'blog.title': '블로그', 
    'about.title': '소개', 
    'about.contact': '문의', 'about.contactBody': '질문이나 제안이 있으면 아래 양식을 작성해 주세요. 확인 후 답변드리겠습니다.',
    'policy.title': '개인정보 처리방침',
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
