import { AppDataSource } from '../config/data-source';
import { Coin } from '../models/coin';
import { tb_5min } from '../models/tb_5min';
import { tb_hour } from '../models/tb_hour';
import { tb_day } from '../models/tb_day';
import { tb_month } from '../models/tb_month';
import logger from '../log/logger';
import { coinDataBuffer } from './coinService';

/**
 * 1분 데이터 저장 (coinDataBuffer에서 직접 저장)
 */
export const aggregate1Min = async () => {
    try {
        const latestCoinDataArray = Object.values(coinDataBuffer) as any[];

        if (latestCoinDataArray.length > 0) {
            const now = new Date();
            // 현재 시간을 1분 단위로 내림
            const timeId = Math.floor(now.getTime() / (60 * 1000)) * (60 * 1000);
            
            const coinRepository = AppDataSource.getRepository(Coin);
            
            let savedCount = 0;
            for (const coinData of latestCoinDataArray) {
                // 1분 단위 고유 ID로 변경
                const dataToSave = {
                    ...coinData,
                    id: timeId,
                    createdAt: new Date(timeId),
                    updatedAt: new Date()
                };

                // 중복 체크
                const existing = await coinRepository.findOne({
                    where: { 
                        id: dataToSave.id, 
                        coin_id: dataToSave.coin_id 
                    }
                });

                if (!existing) {
                    await coinRepository.save(dataToSave);
                    savedCount++;
                }
            }

            if (savedCount > 0) {
                logger.info(`[1분] 집계 완료: ${savedCount}개 코인`);
            }
        }
    } catch (err: any) {
        logger.error(`[1분] 집계 실패: ${err.message}`);
    }
};

/**
 * 5분 집계 실행 (coinDataBuffer에서 직접 저장)
 */
export const aggregate5Min = async () => {
    try {
        const latestCoinDataArray = Object.values(coinDataBuffer) as any[];

        if (latestCoinDataArray.length > 0) {
            const now = new Date();
            // 현재 시간을 5분 단위로 내림
            const timeId = Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
            
            const repository = AppDataSource.getRepository(tb_5min);
            
            let savedCount = 0;
            for (const coinData of latestCoinDataArray) {
                // 5분 단위 고유 ID로 변경
                const dataToSave = {
                    ...coinData,
                    id: timeId,
                    createdAt: new Date(timeId),
                    updatedAt: new Date()
                };

                // 중복 체크
                const existing = await repository.findOne({
                    where: { 
                        id: dataToSave.id, 
                        coin_id: dataToSave.coin_id 
                    }
                });

                if (!existing) {
                    await repository.save(dataToSave);
                    savedCount++;
                }
            }

            if (savedCount > 0) {
                logger.info(`[5분] 집계 완료: ${savedCount}개 코인`);
            }
        }
    } catch (err: any) {
        logger.error(`[5분] 집계 실패: ${err.message}`);
    }
};

/**
 * 1시간 집계 실행 (coinDataBuffer에서 직접 저장)
 */
export const aggregate1Hour = async () => {
    try {
        const latestCoinDataArray = Object.values(coinDataBuffer) as any[];

        if (latestCoinDataArray.length > 0) {
            const now = new Date();
            // 현재 시간을 1시간 단위로 내림
            const timeId = Math.floor(now.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000);
            
            const repository = AppDataSource.getRepository(tb_hour);
            
            let savedCount = 0;
            for (const coinData of latestCoinDataArray) {
                // 1시간 단위 고유 ID로 변경
                const dataToSave = {
                    ...coinData,
                    id: timeId,
                    createdAt: new Date(timeId),
                    updatedAt: new Date()
                };

                // 중복 체크
                const existing = await repository.findOne({
                    where: { 
                        id: dataToSave.id, 
                        coin_id: dataToSave.coin_id 
                    }
                });

                if (!existing) {
                    await repository.save(dataToSave);
                    savedCount++;
                }
            }

            if (savedCount > 0) {
                logger.info(`[1시간] 집계 완료: ${savedCount}개 코인`);
            }
        }
    } catch (err: any) {
        logger.error(`[1시간] 집계 실패: ${err.message}`);
    }
};

/**
 * 1일 집계 실행 (coinDataBuffer에서 직접 저장)
 */
export const aggregate1Day = async () => {
    try {
        const latestCoinDataArray = Object.values(coinDataBuffer) as any[];

        if (latestCoinDataArray.length > 0) {
            const now = new Date();
            // 현재 날짜를 1일 단위로 내림 (자정)
            const timeId = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            
            const repository = AppDataSource.getRepository(tb_day);
            
            let savedCount = 0;
            for (const coinData of latestCoinDataArray) {
                // 1일 단위 고유 ID로 변경
                const dataToSave = {
                    ...coinData,
                    id: timeId,
                    createdAt: new Date(timeId),
                    updatedAt: new Date()
                };

                // 중복 체크
                const existing = await repository.findOne({
                    where: { 
                        id: dataToSave.id, 
                        coin_id: dataToSave.coin_id 
                    }
                });

                if (!existing) {
                    await repository.save(dataToSave);
                    savedCount++;
                }
            }

            if (savedCount > 0) {
                logger.info(`[1일] 집계 완료: ${savedCount}개 코인`);
            }
        }
    } catch (err: any) {
        logger.error(`[1일] 집계 실패: ${err.message}`);
    }
};

/**
 * 1개월 집계 실행 (coinDataBuffer에서 직접 저장)
 */
export const aggregate1Month = async () => {
    try {
        const latestCoinDataArray = Object.values(coinDataBuffer) as any[];

        if (latestCoinDataArray.length > 0) {
            const now = new Date();
            // 현재 월의 첫날
            const timeId = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            
            const repository = AppDataSource.getRepository(tb_month);
            
            let savedCount = 0;
            for (const coinData of latestCoinDataArray) {
                // 1개월 단위 고유 ID로 변경
                const dataToSave = {
                    ...coinData,
                    id: timeId,
                    createdAt: new Date(timeId),
                    updatedAt: new Date()
                };

                // 중복 체크
                const existing = await repository.findOne({
                    where: { 
                        id: dataToSave.id, 
                        coin_id: dataToSave.coin_id 
                    }
                });

                if (!existing) {
                    await repository.save(dataToSave);
                    savedCount++;
                }
            }

            if (savedCount > 0) {
                logger.info(`[1개월] 집계 완료: ${savedCount}개 코인`);
            }
        }
    } catch (err: any) {
        logger.error(`[1개월] 집계 실패: ${err.message}`);
    }
};

// 타이머 ID를 저장할 변수들
let timer1Min: NodeJS.Timeout | null = null;
let timer5Min: NodeJS.Timeout | null = null;
let timer1Hour: NodeJS.Timeout | null = null;
let timer1Day: NodeJS.Timeout | null = null;
let timer1Month: NodeJS.Timeout | null = null;

/**
 * 주기적 집계 타이머 등록
 */
export function registerAggregateTimers(serverStartTime: Date) {
    logger.info('집계 타이머 등록 시작');

    // 기존 타이머가 있다면 정리
    if (timer1Min) clearInterval(timer1Min);
    if (timer5Min) clearInterval(timer5Min);
    if (timer1Hour) clearInterval(timer1Hour);
    if (timer1Day) clearInterval(timer1Day);
    if (timer1Month) clearInterval(timer1Month);

    // 1분마다 1분 데이터 저장
    timer1Min = setInterval(async () => {
        await aggregate1Min();
    }, 60 * 1000); // 1분

    // 5분마다 5분 집계 실행
    timer5Min = setInterval(async () => {
        await aggregate5Min();
    }, 5 * 60 * 1000); // 5분

    // 1시간마다 1시간 집계 실행
    timer1Hour = setInterval(async () => {
        await aggregate1Hour();
    }, 60 * 60 * 1000); // 1시간

    // 1일마다 1일 집계 실행 (자정에 실행)
    timer1Day = setInterval(async () => {
        await aggregate1Day();
    }, 24 * 60 * 60 * 1000); // 24시간

    // 1개월마다 1개월 집계 실행
    timer1Month = setInterval(async () => {
        await aggregate1Month();
    }, 30 * 24 * 60 * 60 * 1000); // 30일

    logger.info('집계 타이머 등록 완료 (1분, 5분, 1시간, 1일, 1개월)');
}

/**
 * 타이머 정리 함수
 */
export function clearAggregateTimers() {
    if (timer1Min) {
        clearInterval(timer1Min);
        timer1Min = null;
    }
    if (timer5Min) {
        clearInterval(timer5Min);
        timer5Min = null;
    }
    if (timer1Hour) {
        clearInterval(timer1Hour);
        timer1Hour = null;
    }
    if (timer1Day) {
        clearInterval(timer1Day);
        timer1Day = null;
    }
    if (timer1Month) {
        clearInterval(timer1Month);
        timer1Month = null;
    }
    logger.info('집계 타이머 정리 완료');
} 