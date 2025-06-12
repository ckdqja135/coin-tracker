import { Request, Response } from 'express';
import { HistoryService, TimeFrame } from '../service/historyService';

/**
 * 히스토리 데이터를 조회
 */
export const getHistory = async (req: Request, res: Response) => {
	const { symbol, timeFrame, limit } = req.validatedQuery!;

	try {
		const historyData = await HistoryService.getHistoryData(
		symbol, 
		timeFrame as TimeFrame, 
		limit!
		);

		// 데이터가 없는 경우
		if (historyData.length === 0) {
		return res.status(404).json({ 
			error: 'No data found for the specified symbol and timeFrame',
			symbol,
			timeFrame
		});
		}

		// 응답 데이터 구성
		const response = {
		symbol,
		timeFrame,
		count: historyData.length,
		data: historyData.map(item => ({
			timestamp: item.timestamp,
			price: item.price,
			open: item.open,
			high: item.high,
			low: item.low,
			close: item.close
		}))
		};

		res.json(response);
	} catch (error: any) {
		console.error('Error fetching history data:', error);
		res.status(500).json({ 
		error: 'Internal server error',
		message: error.message 
		});
	}
};

/**
 * 지정된 기간의 히스토리 데이터를 조회
 */
export const getHistoryByDateRange = async (req: Request, res: Response) => {
	const { symbol, timeFrame, startDate, endDate } = req.validatedQuery!;

	try {
		const historyData = await HistoryService.getHistoryDataByDateRange(
		symbol,
		timeFrame as TimeFrame,
		startDate!,
		endDate!
		);

		// 응답 데이터 구성
		const response = {
		symbol,
		timeFrame,
		startDate: startDate!.toISOString(),
		endDate: endDate!.toISOString(),
		count: historyData.length,
		data: historyData.map(item => ({
			timestamp: item.timestamp,
			price: item.price,
			open: item.open,
			high: item.high,
			low: item.low,
			close: item.close
		}))
		};

		res.json(response);
	} catch (error: any) {
		console.error('Error fetching history data by date range:', error);
		res.status(500).json({ 
		error: 'Internal server error',
		message: error.message 
		});
	}
};

/**
 * 최신 데이터를 조회
 */
export const getLatestData = async (req: Request, res: Response) => {
	const { symbol, timeFrame } = req.validatedQuery!;

	try {
		const latestData = await HistoryService.getLatestData(
		symbol,
		timeFrame as TimeFrame
		);

		if (!latestData) {
		return res.status(404).json({ 
			error: 'No data found for the specified symbol and timeFrame',
			symbol,
			timeFrame
		});
		}

		const response = {
		symbol,
		timeFrame,
		data: {
			timestamp: latestData.timestamp,
			price: latestData.price,
			open: latestData.open,
			high: latestData.high,
			low: latestData.low,
			close: latestData.close
		}
		};

		res.json(response);
	} catch (error: any) {
		console.error('Error fetching latest data:', error);
		res.status(500).json({ 
		error: 'Internal server error',
		message: error.message 
		});
	}
}; 