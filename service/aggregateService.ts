import { AppDataSource } from '../config/data-source';
import { Coin } from '../models/Coin';
import { tb_5min } from '../models/tb_5min';
import { tb_hour } from '../models/tb_hour';
import { tb_day } from '../models/tb_day';
import { tb_month } from '../models/tb_month';

// 범용 집계 함수
export const aggregateSinceStart = async (from: Date, to: Date, aggRepo: any, label: string) => {
    const repo = AppDataSource.getRepository(Coin);

  // 코인별 집계
    const coins = await repo
        .createQueryBuilder('coin')
        .select('coin.coin_id', 'coin_id')
        .addSelect('MIN(coin.createdAt)', 'start')
        .addSelect('MAX(coin.createdAt)', 'end')
        .addSelect('MIN(coin.open)', 'open')
        .addSelect('MAX(coin.close)', 'close')
        .addSelect('MAX(coin.high)', 'high')
        .addSelect('MIN(coin.low)', 'low')
        .where('coin.createdAt BETWEEN :from AND :to', { from, to })
        .groupBy('coin.coin_id')
        .getRawMany();

    for (const c of coins) {
        await aggRepo.save({
            id: new Date(c.start).getTime(),
            coin_id: c.coin_id,
            open: Number(c.open),
            close: Number(c.close),
            high: Number(c.high),
            low: Number(c.low),
            createdAt: c.start,
            updatedAt: c.end,
        });
    }
    console.log(`[${label}] 집계 완료: ${from.toISOString()} ~ ${to.toISOString()}`);
};

// 서버 시작 시 타이머 등록 함수
export function registerAggregateTimers(serverStartTime: Date) {
    setTimeout(() => {
        aggregateSinceStart(serverStartTime, new Date(), AppDataSource.getRepository(tb_5min), '5분');
    }, 5 * 60 * 1000);

    setTimeout(() => {
        aggregateSinceStart(serverStartTime, new Date(), AppDataSource.getRepository(tb_hour), '1시간');
    }, 60 * 60 * 1000);

    setTimeout(() => {
        aggregateSinceStart(serverStartTime, new Date(), AppDataSource.getRepository(tb_day), '1일');
    }, 24 * 60 * 60 * 1000);

    setTimeout(() => {
        aggregateSinceStart(serverStartTime, new Date(), AppDataSource.getRepository(tb_month), '1달');
    }, 30 * 24 * 60 * 60 * 1000);
} 