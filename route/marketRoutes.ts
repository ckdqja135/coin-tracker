import { Router } from 'express';
import { klines, metric, longShort, premium, snapshot } from '../controller/marketController';

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

export default router;
