import { Request, Response, NextFunction } from 'express';
import { isValidTimeFrame } from '../service/coinService';

// Request 타입 확장
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

/**
 * 기본 히스토리 쿼리 검증 미들웨어
 */
export const validateHistoryQuery = (req: Request, res: Response, next: NextFunction) => {
	const { symbol, timeFrame, limit } = req.query;

	// 필수 파라미터 검증
	if (!symbol || typeof symbol !== 'string') {
		return res.status(400).json({ 
		error: 'symbol parameter is required and must be a string' 
		});
	}

	if (!timeFrame || typeof timeFrame !== 'string') {
		return res.status(400).json({ 
		error: 'timeFrame parameter is required and must be a string' 
		});
	}

	// timeFrame 유효성 검증
	if (!isValidTimeFrame(timeFrame)) {
		return res.status(400).json({ 
		error: 'Invalid timeFrame. Supported values: 1m, 5m, 1h, 1d, 1M' 
		});
	}

	// limit 검증 (선택적)
	let parsedLimit = 100; // 기본값
	if (limit) {
		if (typeof limit !== 'string' || isNaN(Number(limit))) {
			return res.status(400).json({ 
			error: 'limit parameter must be a valid number' 
			});
		}
		parsedLimit = parseInt(limit, 10);
		if (parsedLimit <= 0 || parsedLimit > 1000) {
			return res.status(400).json({ 
			error: 'limit must be between 1 and 1000' 
			});
		}
	}

	// 검증된 쿼리를 req에 저장
	req.validatedQuery = {
		symbol: symbol.toUpperCase(),
		timeFrame,
		limit: parsedLimit
	};

	next();
};

/**
 * 날짜 범위 쿼리 검증 미들웨어
 */
export const validateDateRangeQuery = (req: Request, res: Response, next: NextFunction) => {
	const { symbol, timeFrame, startDate, endDate } = req.query;

	// 필수 파라미터 검증
	if (!symbol || typeof symbol !== 'string') {
		return res.status(400).json({ 
		error: 'symbol parameter is required and must be a string' 
		});
	}

	if (!timeFrame || typeof timeFrame !== 'string') {
		return res.status(400).json({ 
		error: 'timeFrame parameter is required and must be a string' 
		});
	}

	if (!startDate || typeof startDate !== 'string') {
		return res.status(400).json({ 
		error: 'startDate parameter is required and must be a string' 
		});
	}

	if (!endDate || typeof endDate !== 'string') {
		return res.status(400).json({ 
		error: 'endDate parameter is required and must be a string' 
		});
	}

	// timeFrame 유효성 검증
	if (!isValidTimeFrame(timeFrame)) {
		return res.status(400).json({ 
		error: 'Invalid timeFrame. Supported values: 1m, 5m, 1h, 1d, 1M' 
		});
	}

	// 날짜 형식 검증
	const parsedStartDate = new Date(startDate);
	const parsedEndDate = new Date(endDate);

	if (isNaN(parsedStartDate.getTime())) {
		return res.status(400).json({ 
		error: 'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' 
		});
	}

	if (isNaN(parsedEndDate.getTime())) {
		return res.status(400).json({ 
		error: 'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' 
		});
	}

	// 날짜 범위 검증
	if (parsedStartDate >= parsedEndDate) {
		return res.status(400).json({ 
		error: 'startDate must be earlier than endDate' 
		});
	}

	// 최대 범위 검증 (예: 1년)
	const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1년
	if (parsedEndDate.getTime() - parsedStartDate.getTime() > maxRangeMs) {
		return res.status(400).json({ 
		error: 'Date range cannot exceed 1 year' 
		});
	}

	// 검증된 쿼리를 req에 저장
	req.validatedQuery = {
		symbol: symbol.toUpperCase(),
		timeFrame,
		startDate: parsedStartDate,
		endDate: parsedEndDate
	};

	next();
};

/**
 * 최신 데이터 쿼리 검증 미들웨어
 */
export const validateLatestDataQuery = (req: Request, res: Response, next: NextFunction) => {
	const { symbol, timeFrame } = req.query;

	// 필수 파라미터 검증
	if (!symbol || typeof symbol !== 'string') {
		return res.status(400).json({ 
		error: 'symbol parameter is required and must be a string' 
		});
	}

	if (!timeFrame || typeof timeFrame !== 'string') {
		return res.status(400).json({ 
		error: 'timeFrame parameter is required and must be a string' 
		});
	}

	// timeFrame 유효성 검증
	if (!isValidTimeFrame(timeFrame)) {
		return res.status(400).json({ 
		error: 'Invalid timeFrame. Supported values: 1m, 5m, 1h, 1d, 1M' 
		});
	}

	// 검증된 쿼리를 req에 저장
	req.validatedQuery = {
		symbol: symbol.toUpperCase(),
		timeFrame
	};

	next();
}; 