import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from './lib/chartUtils';

export type Lang = 'en' | 'ko';

const dict = {
  en: {
    'home.cimRef': 'base',
    'home.cimVsBtc': 'Altcoins vs BTC',
    'chat.title': 'Chat', 'chat.online': '{n} online', 'chat.close': 'Close chat', 'chat.empty': 'No messages yet. Say hi!', 'chat.connecting': 'Connecting…',
    'chat.nick': 'Nickname', 'chat.placeholder': 'Message (max 200 chars)', 'chat.send': 'Send',
    'chat.rules': 'Anonymous public chat. Profanity is masked, links are blocked, and messages are not stored permanently. Be respectful.',
    'chat.err.rate': 'You are sending too fast. Wait a moment.', 'chat.err.link': 'Links are not allowed.', 'chat.err.empty': 'Enter a nickname and a message.', 'chat.err.nick': 'This nickname is not allowed. Please choose another.',
    'arb.title': 'Arbitrage calculator', 'arb.coin': 'Coin', 'arb.buyOn': 'Buy on', 'arb.sellOn': 'Sell on', 'arb.amount': 'Amount (KRW)',
    'arb.buyFee': 'Buy fee (%)', 'arb.sellFee': 'Sell fee (%)', 'arb.withdrawFee': 'Withdrawal fee ({coin})',
    'arb.gap': 'Price gap', 'arb.received': 'You get', 'arb.profit': 'Profit', 'arb.noPrice': 'No price for this coin on one of the exchanges.',
    'arb.help': 'Buys with the amount on one exchange, moves the coin, and sells it on the other at current prices. USD exchanges are converted at the USD/KRW rate.',
    'arb.note': 'Default fees are typical standard-tier rates and may differ for you. Currency conversion costs and price moves during the transfer are not included. Not investment advice.',
    'alert.heading': 'Kimchi premium alerts', 'alert.title': 'Kimchi premium alert', 'alert.body': '{coin} on {ex}: premium {v}',
    'alert.exchange': 'Exchange', 'alert.when': 'When premium is', 'alert.above': 'at or above', 'alert.below': 'at or below', 'alert.value': 'Premium (%)',
    'alert.add': 'Add', 'alert.remove': 'Remove alert', 'alert.firedAt': 'fired {time}', 'alert.notTracked': 'add coin above',
    'alert.help': 'Premium against Binance (USD × USD/KRW). Sends a browser notification when the premium crosses your level. Works only while this page is open.',
    'alert.denied': 'Browser notifications are blocked. Allow them in your browser settings to get alerts.',
    'alert.unsupported': 'This browser does not support notifications. Alerts are shown on this page only.',
    'nav.notices': 'Notices', 'notices.title': 'Exchange Notices',
    'notices.intro': 'Latest announcements from Upbit and Bithumb. New listings, delistings and caution designations are tagged. Tap a coin to add it to the home monitor.',
    'notices.filter.all': 'All', 'notices.filter.listing': 'Listings', 'notices.filter.risk': 'Delisting · Caution', 'notices.allExchanges': 'All exchanges',
    'notices.kind.listing': 'Listing', 'notices.kind.delisting': 'Delisting', 'notices.kind.warning': 'Caution', 'notices.kind.other': '',
    'notices.empty': 'No notices', 'notices.watch': 'Add to home monitor',
    'liq.title': 'Liquidations', 'liq.longs': 'Longs liquidated', 'liq.shorts': 'Shorts liquidated', 'liq.total': 'Total', 'liq.recent': 'Recent liquidations',
    'liq.long': 'Long', 'liq.short': 'Short', 'liq.empty': 'No liquidations yet',
    'liq.help': 'Forced liquidations of futures positions on Binance, Bybit and OKX, collected by our server while it runs. Binance only publishes the largest liquidation per second, so its total is a lower bound.',
    'ind.usdKrw': 'USD/KRW', 'ind.usdt': 'USDT', 'ind.usdtPremium': 'Tether premium', 'ind.fng': 'Fear & Greed', 'ind.yesterday': 'yesterday {v}',
    'ind.usdtHelp': 'Upbit KRW-USDT price compared with the USD/KRW exchange rate. A positive value means dollars (stablecoins) trade at a premium in Korea.',
    'ind.fngHelp': 'Crypto Fear & Greed Index from alternative.me (0 = extreme fear, 100 = extreme greed). Updated once a day.',
    'fng.Extreme Fear': 'Extreme Fear', 'fng.Fear': 'Fear', 'fng.Neutral': 'Neutral', 'fng.Greed': 'Greed', 'fng.Extreme Greed': 'Extreme Greed',
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
    'group.mining': 'Mining Information', 'group.trending': 'Trending', 'group.premium': 'Kimchi Premium',
    'cards.all': 'All', 'cards.search': 'Search', 'cards.custom': 'Custom', 'cards.customHelp': 'Show only charts saved with ♥',
    'cards.empty': 'No charts saved yet. Press ♥ on a card to add it.',
    'nav.calendar': 'Calendar', 'search.coins': 'Try to search coins',
    'ticker.change': '24h Change', 'ticker.high': '24h High', 'ticker.low': '24h Low', 'ticker.mcap': 'Market Cap',
    'home.clearAll': 'Clear All', 'home.reload': 'Reload', 'home.listing': 'Listing', 'home.premium': 'Premium',
    'home.currencyToggle': 'Switch USD / KRW',
    'home.listingHelp': 'Shows whether each coin is listed on each exchange and its current price. Price is green if the coin\'s 24h change on that exchange beats BTC\'s, red if worse (Upbit counts from 09:00 KST; other exchanges use a rolling 24 hours).',
    'home.premiumHelp': 'Price difference of each exchange compared with {ex} (converted to USD).',
    'home.cimHelp': 'Minute-by-minute % change of the selected coins since today\'s 09:00 KST open on the base exchange, resetting daily at 09:00. Altcoins are shown relative to BTC: BTC is the 0% baseline, and a line above it means the coin is outperforming BTC. BTC\'s own change appears in the legend and tooltip. Spot which coin moves first.',
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
    'home.cimRef': '기준',
    'home.cimVsBtc': '알트코인은 BTC 대비',
    'chat.title': '채팅', 'chat.online': '{n}명 접속', 'chat.close': '채팅 닫기', 'chat.empty': '아직 메시지가 없습니다. 먼저 인사해 보세요!', 'chat.connecting': '연결 중…',
    'chat.nick': '닉네임', 'chat.placeholder': '메시지 (최대 200자)', 'chat.send': '전송',
    'chat.rules': '익명 공개 채팅입니다. 욕설은 가려지고 링크는 보낼 수 없으며, 메시지는 영구 저장되지 않습니다. 서로 존중해 주세요.',
    'chat.err.rate': '너무 빠르게 보내고 있습니다. 잠시 후 다시 보내 주세요.', 'chat.err.link': '링크는 보낼 수 없습니다.', 'chat.err.empty': '닉네임과 메시지를 입력해 주세요.', 'chat.err.nick': '사용할 수 없는 닉네임입니다. 다른 닉네임을 입력해 주세요.',
    'arb.title': '차익 계산기', 'arb.coin': '코인', 'arb.buyOn': '살 곳', 'arb.sellOn': '팔 곳', 'arb.amount': '금액 (원)',
    'arb.buyFee': '매수 수수료 (%)', 'arb.sellFee': '매도 수수료 (%)', 'arb.withdrawFee': '출금 수수료 ({coin})',
    'arb.gap': '가격 차이', 'arb.received': '받는 금액', 'arb.profit': '수익', 'arb.noPrice': '두 거래소 중 한 곳에 이 코인 시세가 없습니다.',
    'arb.help': '한 거래소에서 입력한 금액만큼 사서 코인을 옮긴 뒤 다른 거래소에서 현재가로 팔았을 때의 결과입니다. 달러 거래소는 원/달러 환율로 환산합니다.',
    'arb.note': '기본 수수료는 일반 등급 기준이며 실제와 다를 수 있습니다. 환전 비용과 송금 중 가격 변동은 반영하지 않습니다. 투자 조언이 아닙니다.',
    'alert.heading': '김프 알림', 'alert.title': '김프 알림', 'alert.body': '{ex} {coin} 김프 {v}',
    'alert.exchange': '거래소', 'alert.when': '김프가', 'alert.above': '이상', 'alert.below': '이하', 'alert.value': '기준 (%)',
    'alert.add': '추가', 'alert.remove': '알림 삭제', 'alert.firedAt': '{time} 알림', 'alert.notTracked': '위에서 코인 추가 필요',
    'alert.help': '바이낸스 가격(달러 × 원/달러 환율) 대비 김프입니다. 설정한 값을 넘는 순간 브라우저 알림을 보냅니다. 이 페이지가 열려 있을 때만 동작합니다.',
    'alert.denied': '브라우저 알림이 차단되어 있습니다. 브라우저 설정에서 허용해야 알림을 받을 수 있습니다.',
    'alert.unsupported': '이 브라우저는 알림을 지원하지 않습니다. 이 페이지에서만 표시됩니다.',
    'nav.notices': '공지', 'notices.title': '거래소 공지',
    'notices.intro': '업비트·빗썸의 최근 공지입니다. 신규 상장, 거래지원 종료, 유의 종목 지정을 표시합니다. 코인을 누르면 홈 모니터에 추가됩니다.',
    'notices.filter.all': '전체', 'notices.filter.listing': '상장', 'notices.filter.risk': '상장폐지 · 유의', 'notices.allExchanges': '전체 거래소',
    'notices.kind.listing': '상장', 'notices.kind.delisting': '거래지원 종료', 'notices.kind.warning': '유의', 'notices.kind.other': '',
    'notices.empty': '공지가 없습니다', 'notices.watch': '홈 모니터에 추가',
    'liq.title': '청산', 'liq.longs': '롱 청산', 'liq.shorts': '숏 청산', 'liq.total': '합계', 'liq.recent': '최근 청산',
    'liq.long': '롱', 'liq.short': '숏', 'liq.empty': '아직 청산이 없습니다',
    'liq.help': '바이낸스·바이비트·OKX 선물의 강제청산을 서버가 켜져 있는 동안 모은 값입니다. 바이낸스는 1초마다 가장 큰 청산 1건만 공개하므로 바이낸스 합계는 실제보다 작을 수 있습니다.',
    'ind.usdKrw': '원/달러', 'ind.usdt': '테더', 'ind.usdtPremium': '테더 김프', 'ind.fng': '공포·탐욕', 'ind.yesterday': '어제 {v}',
    'ind.usdtHelp': '업비트 테더(KRW-USDT) 가격을 원/달러 환율과 비교한 값입니다. +면 국내에서 달러(스테이블코인)가 웃돈을 받고 거래되고 있다는 뜻입니다.',
    'ind.fngHelp': 'alternative.me의 크립토 공포·탐욕 지수입니다 (0 = 극단적 공포, 100 = 극단적 탐욕). 하루에 한 번 갱신됩니다.',
    'fng.Extreme Fear': '극단적 공포', 'fng.Fear': '공포', 'fng.Neutral': '중립', 'fng.Greed': '탐욕', 'fng.Extreme Greed': '극단적 탐욕',
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
    'group.mining': '채굴 정보', 'group.trending': '트렌드', 'group.premium': '김치 프리미엄',
    'cards.all': '전체', 'cards.search': '검색', 'cards.custom': '내 차트', 'cards.customHelp': '♥로 저장한 차트만 보기',
    'cards.empty': '저장한 차트가 없습니다. 카드의 ♥를 눌러 추가하세요.',
    'nav.calendar': '캘린더', 'search.coins': '코인을 검색해 보세요',
    'ticker.change': '24시간 변동', 'ticker.high': '24시간 고가', 'ticker.low': '24시간 저가', 'ticker.mcap': '시가총액',
    'home.clearAll': '전체 삭제', 'home.reload': '새로고침', 'home.listing': '상장', 'home.premium': '프리미엄',
    'home.currencyToggle': 'USD / KRW 전환',
    'home.listingHelp': '거래소별 상장 여부와 현재가를 보여줍니다. 그 거래소의 24시간 등락률이 BTC보다 높으면(덜 내리면) 가격이 초록, 낮으면 빨강입니다 (업비트는 09:00 KST 기준, 다른 거래소는 최근 24시간 기준).',
    'home.premiumHelp': '{ex} 대비 각 거래소의 가격 차이입니다 (USD 환산).',
    'home.cimHelp': '기준 거래소에서 오늘 09:00(KST) 시가 대비 선택한 코인들의 등락률을 1분 단위로 보여줍니다. 매일 09:00에 초기화됩니다. 알트코인은 BTC 대비 상대 등락률로, BTC가 0% 기준선이며 기준선 위에 있으면 BTC보다 강한 것입니다. BTC 자체 등락률은 범례와 툴팁에서 확인할 수 있습니다. 어떤 코인이 먼저 움직이는지 확인하세요.',
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
