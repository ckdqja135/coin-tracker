import { AppDataSource } from '../config/data-source';
import { Coin } from '../models/coin';
import { tb_5min } from '../models/tb_5min';
import { tb_hour } from '../models/tb_hour';
import { tb_day } from '../models/tb_day';
import { tb_month } from '../models/tb_month';
import logger from '../log/logger';

/**
 * 지정된 시간 범위의 1분 데이터를 집계하여 상위 시간 단위로 변환
 */
export const aggregateData = async (
    startTime: Date, 
    endTime: Date, 
    targetRepository: any, 
    timeFrame: string
) => {
    const coinRepo = AppDataSource.getRepository(Coin);

    try {
        // 해당 시간 범위의 코인별 집계 데이터 계산
        const aggregatedData = await coinRepo
            .createQueryBuilder('coin')
            .select('coin.coin_id', 'coin_id')
            .addSelect('MIN(coin.open)', 'open')
            .addSelect('MAX(coin.close)', 'close')
            .addSelect('MAX(coin.high)', 'high')
            .addSelect('MIN(coin.low)', 'low')
            .addSelect('MIN(coin.createdAt)', 'start_time')
            .addSelect('MAX(coin.createdAt)', 'end_time')
            .where('coin.createdAt >= :startTime AND coin.createdAt < :endTime', { 
                startTime, 
                endTime 
            })
            .groupBy('coin.coin_id')
            .getRawMany();

        if (aggregatedData.length === 0) {
            // 집계할 데이터가 없을 때는 로그를 출력하지 않음 (스팸 방지)
            return;
        }

        let savedCount = 0;
        // 집계된 데이터를 해당 테이블에 저장
        for (const data of aggregatedData) {
            const aggregateRecord = {
                id: startTime.getTime(), // 시작 시간을 ID로 사용
                coin_id: data.coin_id,
                open: Number(data.open),
                close: Number(data.close),
                high: Number(data.high),
                low: Number(data.low),
                createdAt: startTime,
                updatedAt: new Date()
            };

            // 중복 체크 후 저장
            const existing = await targetRepository.findOne({
                where: { 
                    id: aggregateRecord.id, 
                    coin_id: aggregateRecord.coin_id 
                }
            });

            if (!existing) {
                await targetRepository.save(aggregateRecord);
                savedCount++;
            }
        }

        if (savedCount > 0) {
            logger.info(`[${timeFrame}] 집계 완료: ${savedCount}개 코인, ${startTime.toISOString()}`);
        }
    } catch (error) {
        logger.error(`[${timeFrame}] 집계 실패:`, error);
    }
};

/**
 * 5분 집계 실행
 */
export const aggregate5Min = async () => {
    const now = new Date();
    // 현재 시간을 5분 단위로 내림 (예: 08:47:xx -> 08:45:00)
    const endTime = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
    const startTime = new Date(endTime.getTime() - (5 * 60 * 1000));

    await aggregateData(
        startTime, 
        endTime, 
        AppDataSource.getRepository(tb_5min), 
        '5분'
    );
};

/**
 * 1시간 집계 실행
 */
export const aggregate1Hour = async () => {
    const now = new Date();
    // 현재 시간을 1시간 단위로 내림
    const endTime = new Date(Math.floor(now.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000));
    const startTime = new Date(endTime.getTime() - (60 * 60 * 1000));

    await aggregateData(
        startTime, 
        endTime, 
        AppDataSource.getRepository(tb_hour), 
        '1시간'
    );
};

/**
 * 1일 집계 실행
 */
export const aggregate1Day = async () => {
    const now = new Date();
    // 현재 날짜를 1일 단위로 내림 (자정으로 설정)
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTime = new Date(endTime.getTime() - (24 * 60 * 60 * 1000));

    await aggregateData(
        startTime, 
        endTime, 
        AppDataSource.getRepository(tb_day), 
        '1일'
    );
};

/**
 * 1개월 집계 실행 (비활성화 - 로그 스팸 방지)
 */
export const aggregate1Month = async () => {
    // 1개월 집계는 현재 비활성화 (로그 스팸 방지)
    // 필요시 수동으로 실행하도록 함
    return;
};

// 타이머 ID를 저장할 변수들
let timer5Min: NodeJS.Timeout | null = null;
let timer1Hour: NodeJS.Timeout | null = null;
let timer1Day: NodeJS.Timeout | null = null;

/**
 * 주기적 집계 타이머 등록
 */
export function registerAggregateTimers(serverStartTime: Date) {
    logger.info('집계 타이머 등록 시작');

    // 기존 타이머가 있다면 정리
    if (timer5Min) clearInterval(timer5Min);
    if (timer1Hour) clearInterval(timer1Hour);
    if (timer1Day) clearInterval(timer1Day);

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

    // 1개월 집계는 비활성화 (로그 스팸 방지)
    // timer1Month = setInterval(async () => {
    //     await aggregate1Month();
    // }, 30 * 24 * 60 * 60 * 1000); // 30일

    // 서버 시작 후 1분 뒤에 첫 5분 집계 실행 (테스트용)
    setTimeout(async () => {
        logger.info('첫 5분 집계 실행');
        await aggregate5Min();
    }, 60 * 1000); // 1분 후

    logger.info('집계 타이머 등록 완료 (5분, 1시간, 1일)');
}

/**
 * 타이머 정리 함수
 */
export function clearAggregateTimers() {
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
    logger.info('집계 타이머 정리 완료');
} 