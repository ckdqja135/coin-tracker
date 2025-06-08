import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Coin } from '../models/Coin';

// /api/history?symbol=BTCUSDT&timeFrame=1m
export const getHistory = async (req: Request, res: Response) => {
  const symbol = String(req.query.symbol);
  const timeFrame = req.query.timeFrame;
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  // 현재는 1m만 지원
  if (timeFrame && timeFrame !== '1m') {
    return res.status(400).json({ error: 'Only 1m timeFrame is supported for now.' });
  }

  try {
    const repo = AppDataSource.getRepository(Coin);
    const rows = await repo.find({
      where: { coin_id: symbol },
      order: { id: 'ASC' },
      take: 100,
    });

    const result = rows.map(row => ({
      timestamp: row.createdAt,
      price: Number(row.close),
    }));

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}; 