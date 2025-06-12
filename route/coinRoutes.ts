import { Router } from 'express';
import { 
    getAllCoinSymbols,
    getHistory,
    getHistoryByDateRange,
    getLatestData
} from '../controller/coinController';
import { 
    validateHistoryQuery,
    validateDateRangeQuery,
    validateLatestDataQuery
} from '../middleware/historyValidation';

const router = Router();

// 전체 코인 목록을 가져오는 엔드포인트
router.get('/symbols', getAllCoinSymbols);

// 히스토리 관련 라우트들
router.get('/history', validateHistoryQuery, getHistory);
router.get('/history/range', validateDateRangeQuery, getHistoryByDateRange);
router.get('/history/latest', validateLatestDataQuery, getLatestData);



export default router;
