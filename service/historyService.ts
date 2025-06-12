import { AppDataSource } from '../config/data-source';
import { Coin } from '../models/coin';
import { tb_5min } from '../models/tb_5min';
import { tb_hour } from '../models/tb_hour';
import { tb_day } from '../models/tb_day';
import { tb_month } from '../models/tb_month';

export interface HistoryData {
    timestamp: Date;
    price: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

export type TimeFrame = '1m' | '5m' | '1h' | '1d' | '1M';

export class HistoryService {
    /**
     * 지정된 심볼과 시간 프레임에 따라 히스토리 데이터를 조회합니다.
     * @param symbol 코인 심볼 (예: BTCUSDT)
     * @param timeFrame 시간 프레임 (1m, 5m, 1h, 1d, 1M)
     * @param limit 조회할 데이터 개수 (기본값: 100)
     * @returns 히스토리 데이터 배열
     */
    static async getHistoryData(
        symbol: string, 
        timeFrame: TimeFrame, 
        limit: number = 100
    ): Promise<HistoryData[]> {
        let repository;
        
        // 시간 프레임에 따라 적절한 테이블 선택
        switch (timeFrame) {
            case '1m':
                repository = AppDataSource.getRepository(Coin);
                break;
            case '5m':
                repository = AppDataSource.getRepository(tb_5min);
                break;
            case '1h':
                repository = AppDataSource.getRepository(tb_hour);
                break;
            case '1d':
                repository = AppDataSource.getRepository(tb_day);
                break;
            case '1M':
                repository = AppDataSource.getRepository(tb_month);
                break;
            default:
                throw new Error(`Unsupported timeFrame: ${timeFrame}`);
        }

        try {
            const rows = await repository.find({
                where: { coin_id: symbol },
                order: { id: 'ASC' },
                take: limit,
            });

            return rows.map(row => ({
                timestamp: row.createdAt,
                price: Number(row.close),
                open: Number(row.open),
                high: Number(row.high),
                low: Number(row.low),
                close: Number(row.close),
            }));
        } catch (error) {
            throw new Error(`Failed to fetch history data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 지정된 심볼의 최신 데이터를 조회합니다.
     * @param symbol 코인 심볼
     * @param timeFrame 시간 프레임
     * @returns 최신 데이터 또는 null
     */
    static async getLatestData(symbol: string, timeFrame: TimeFrame): Promise<HistoryData | null> {
        const data = await this.getHistoryData(symbol, timeFrame, 1);
        return data.length > 0 ? data[0] : null;
    }

    /**
     * 지정된 기간 동안의 히스토리 데이터를 조회합니다.
     * @param symbol 코인 심볼
     * @param timeFrame 시간 프레임
     * @param startDate 시작 날짜
     * @param endDate 종료 날짜
     * @returns 히스토리 데이터 배열
     */
    static async getHistoryDataByDateRange(
        symbol: string,
        timeFrame: TimeFrame,
        startDate: Date,
        endDate: Date
    ): Promise<HistoryData[]> {
        let repository;
        
        switch (timeFrame) {
            case '1m':
                repository = AppDataSource.getRepository(Coin);
                break;
            case '5m':
                repository = AppDataSource.getRepository(tb_5min);
                break;
            case '1h':
                repository = AppDataSource.getRepository(tb_hour);
                break;
            case '1d':
                repository = AppDataSource.getRepository(tb_day);
                break;
            case '1M':
                repository = AppDataSource.getRepository(tb_month);
                break;
            default:
                throw new Error(`Unsupported timeFrame: ${timeFrame}`);
        }

        try {
            const rows = await repository
                .createQueryBuilder('data')
                .where('data.coin_id = :symbol', { symbol })
                .andWhere('data.createdAt >= :startDate', { startDate })
                .andWhere('data.createdAt <= :endDate', { endDate })
                .orderBy('data.id', 'ASC')
                .getMany();

            return rows.map(row => ({
                timestamp: row.createdAt,
                price: Number(row.close),
                open: Number(row.open),
                high: Number(row.high),
                low: Number(row.low),
                close: Number(row.close),
            }));
        } catch (error) {
            throw new Error(`Failed to fetch history data by date range: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 지원되는 시간 프레임 목록을 반환합니다.
     * @returns 지원되는 시간 프레임 배열
     */
    static getSupportedTimeFrames(): TimeFrame[] {
        return ['1m', '5m', '1h', '1d', '1M'];
    }

    /**
     * 시간 프레임이 유효한지 확인합니다.
     * @param timeFrame 확인할 시간 프레임
     * @returns 유효성 여부
     */
    static isValidTimeFrame(timeFrame: string): timeFrame is TimeFrame {
        return this.getSupportedTimeFrames().includes(timeFrame as TimeFrame);
    }
} 