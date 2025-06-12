import { Router } from 'express';
import { 
    getHistory, 
    getHistoryByDateRange, 
    getLatestData
} from '../controller/historyController';
import {
    validateHistoryQuery,
    validateDateRangeQuery,
    validateLatestDataQuery
} from '../middleware/historyValidation';

const router = Router();

// 기본 히스토리 데이터 조회
// GET /api/history?symbol=BTCUSDT&timeFrame=1m&limit=100
router.get('/history', validateHistoryQuery, getHistory);

// 날짜 범위로 히스토리 데이터 조회
// GET /api/history/range?symbol=BTCUSDT&timeFrame=1h&startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z
router.get('/history/range', validateDateRangeQuery, getHistoryByDateRange);

// 최신 데이터 조회
// GET /api/history/latest?symbol=BTCUSDT&timeFrame=1m
router.get('/history/latest', validateLatestDataQuery, getLatestData);

export default router; 