import { Request, Response } from 'express';
import { getCoinDataFromDB, fetchAllCoinSymbols } from '../service/coinService';

// 1분 단위 코인 데이터 조회
export const getCoinData = async (req: Request, res: Response): Promise<void> => {
    const { coinId } = req.params;
    try {
        const coins = await getCoinDataFromDB(coinId);
        res.json(coins);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// 전체 코인 목록을 가져오는 엔드포인트
export const getAllCoinSymbols = async (req: Request, res: Response): Promise<void> => {
    try {
        const coinSymbols = await fetchAllCoinSymbols();
        res.json(coinSymbols);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
