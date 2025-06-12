import { Request, Response, NextFunction } from 'express';
import { HistoryService } from '../service/historyService';

/**
 * 기본 히스토리 조회 유효성 검증 미들웨어
 */
export const validateHistoryQuery = (req: Request, res: Response, next: NextFunction) => {
  const symbol = String(req.query.symbol);
  const timeFrame = (req.query.timeFrame as string) || '1m';
  const limit = parseInt(req.query.limit as string) || 100;

  // 필수 파라미터 검증
  if (!symbol) {
    return res.status(400).json({ 
      error: 'symbol is required',
      example: '/api/history?symbol=BTCUSDT&timeFrame=1m&limit=100'
    });
  }

  // 시간 프레임 유효성 검증
  if (!HistoryService.isValidTimeFrame(timeFrame)) {
    return res.status(400).json({ 
      error: `Invalid timeFrame. Supported timeFrames: ${HistoryService.getSupportedTimeFrames().join(', ')}`,
      provided: timeFrame
    });
  }

  // limit 범위 검증
  if (limit < 1 || limit > 1000) {
    return res.status(400).json({ 
      error: 'limit must be between 1 and 1000',
      provided: limit
    });
  }

  // 검증된 값들을 req에 저장
  req.validatedQuery = {
    symbol,
    timeFrame,
    limit
  };

  next();
};

/**
 * 날짜 범위 조회 유효성 검증 미들웨어
 */
export const validateDateRangeQuery = (req: Request, res: Response, next: NextFunction) => {
  const symbol = String(req.query.symbol);
  const timeFrame = (req.query.timeFrame as string) || '1m';
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  // 필수 파라미터 검증
  if (!symbol || !startDateStr || !endDateStr) {
    return res.status(400).json({ 
      error: 'symbol, startDate, and endDate are required',
      example: '/api/history/range?symbol=BTCUSDT&timeFrame=1m&startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z'
    });
  }

  // 시간 프레임 유효성 검증
  if (!HistoryService.isValidTimeFrame(timeFrame)) {
    return res.status(400).json({ 
      error: `Invalid timeFrame. Supported timeFrames: ${HistoryService.getSupportedTimeFrames().join(', ')}`,
      provided: timeFrame
    });
  }

  // 날짜 형식 검증
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ 
      error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)',
      startDate: startDateStr,
      endDate: endDateStr
    });
  }

  if (startDate >= endDate) {
    return res.status(400).json({ 
      error: 'startDate must be before endDate',
      startDate: startDateStr,
      endDate: endDateStr
    });
  }

  // 검증된 값들을 req에 저장
  req.validatedQuery = {
    symbol,
    timeFrame,
    startDate,
    endDate
  };

  next();
};

/**
 * 최신 데이터 조회 유효성 검증 미들웨어
 */
export const validateLatestDataQuery = (req: Request, res: Response, next: NextFunction) => {
  const symbol = String(req.query.symbol);
  const timeFrame = (req.query.timeFrame as string) || '1m';

  // 필수 파라미터 검증
  if (!symbol) {
    return res.status(400).json({ 
      error: 'symbol is required',
      example: '/api/history/latest?symbol=BTCUSDT&timeFrame=1m'
    });
  }

  // 시간 프레임 유효성 검증
  if (!HistoryService.isValidTimeFrame(timeFrame)) {
    return res.status(400).json({ 
      error: `Invalid timeFrame. Supported timeFrames: ${HistoryService.getSupportedTimeFrames().join(', ')}`,
      provided: timeFrame
    });
  }

  // 검증된 값들을 req에 저장
  req.validatedQuery = {
    symbol,
    timeFrame
  };

  next();
};

// TypeScript 타입 확장
declare global {
  namespace Express {
    interface Request {
      validatedQuery?: {
        symbol: string;
        timeFrame: string;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
      };
    }
  }
} 