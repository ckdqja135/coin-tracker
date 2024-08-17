import { Router } from 'express';
import { getCoinData, getAllCoinSymbols } from '../controller/coinController';

const router = Router();

// 1분 단위 코인 데이터 조회
router.get('/:coinId', getCoinData);

// 전체 코인 목록을 가져오는 엔드포인트
router.get('/symbols', getAllCoinSymbols);

export default router;
