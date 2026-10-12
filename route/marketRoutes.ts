import { Router } from 'express';
import { klines, metric, longShort, premium, snapshot, tickers, coins, overview, coinInfo, series } from '../controller/marketController';

const router = Router();

// 거래소 캔들 (binance / binance-futures / upbit / bithumb / yahoo)
router.get('/klines', klines);
// 바이낸스 선물 파생 지표 (미결제약정, 롱숏비율, 펀딩비 등)
router.get('/metric', metric);
// 거래소별 롱/숏 계정 비율
router.get('/longshort', longShort);
// 김치 프리미엄 시계열
router.get('/premium', premium);
// 코인 요약 정보
router.get('/snapshot', snapshot);
// 거래소별 전체 시세 (업비트/코인원/빗썸/코빗/게이트/바이낸스)
router.get('/tickers', tickers);
// 코인 검색 목록
router.get('/coins', coins);
// 주요 지수 / 크립토 시총 / BTC 도미넌스
router.get('/overview', overview);
// 코인 요약 (시가총액 등)
router.get('/coininfo', coinInfo);
// 비교 카드 보조 시계열 (거래소별 OI, 공포탐욕지수, 해시레이트, 난이도)
router.get('/series', series);

export default router;
