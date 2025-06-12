import axios from 'axios';
import { AppDataSource } from '../config/data-source';
import { Coin } from '../models/coin';
import { tb_5min } from '../models/tb_5min';
import { tb_hour } from '../models/tb_hour';
import { tb_day } from '../models/tb_day';
import { tb_month } from '../models/tb_month';
import logger from '../log/logger';

// 해시맵을 전역 변수로 설정 (export 추가)
export const coinDataBuffer: { [key: string]: any } = {};

// 시간 프레임 타입 정의
export type TimeFrame = '1m' | '5m' | '1h' | '1d' | '1M';

// 지원되는 시간 프레임 목록
const SUPPORTED_TIME_FRAMES: TimeFrame[] = ['1m', '5m', '1h', '1d', '1M'];

// 시간 프레임 유효성 검증
export const isValidTimeFrame = (timeFrame: string): timeFrame is TimeFrame => {
    return SUPPORTED_TIME_FRAMES.includes(timeFrame as TimeFrame);
};

// 지원되는 시간 프레임 목록 반환
export const getSupportedTimeFrames = (): TimeFrame[] => {
    return [...SUPPORTED_TIME_FRAMES];
};

// 시간 프레임에 따른 테이블 엔티티 반환
const getEntityByTimeFrame = (timeFrame: TimeFrame) => {
    switch (timeFrame) {
        case '1m': return Coin;
        case '5m': return tb_5min;
        case '1h': return tb_hour;
        case '1d': return tb_day;
        case '1M': return tb_month;
        default: throw new Error(`Unsupported timeFrame: ${timeFrame}`);
    }
};

// Binance API에서 거래 가능한 전체 코인 목록을 가져오는 함수
export const fetchAllCoinSymbols = async (): Promise<string[]> => {
    try {
        const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
        return response.data.symbols.map((symbol: any) => symbol.symbol);
    } catch (err: any) {
        logger.error(`Error fetching coin symbols: ${err.message}`);
        return [];
    }
};

// 코인 데이터를 Binance API에서 가져오는 함수
export const fetchCoinData = async (coinId: string, io?: any): Promise<any> => {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coinId}`);
        const data = response.data;
        
        // API에서 제공하는 closeTime을 사용하거나, 현재 시간을 ms 단위로 사용
        const apiCloseTime = parseInt(data.closeTime) || Date.now();
        const timestamp = Date.now(); // 현재 시간을 기준으로 사용
        
        const coinData = {
            id: Math.floor(timestamp / 1000) * 1000, // 초 단위로 잘라서 설정
            coin_id: coinId,
            close: parseFloat(data.lastPrice),
            open: parseFloat(data.openPrice),
            high: parseFloat(data.highPrice),
            low: parseFloat(data.lowPrice),
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
            date: new Date(timestamp).toLocaleString(),
            apiCloseTime: apiCloseTime // API에서 제공하는 실제 마감 시간
        };

        // 최신 데이터를 해시맵에 저장
        coinDataBuffer[coinId] = coinData;

        // 모든 종목 데이터를 모아서 출력
        const allCoinData = Object.values(coinDataBuffer).map((data: any) => ({
            Timestamp: data.id,
            CoinName: data.coin_id,
            Close: data.close,
            Open: data.open,
            High: data.high,
            Low: data.low,
            Date: data.date,
            APICloseTime: new Date(data.apiCloseTime).toLocaleString()
        }));

        // console.clear();
        // console.table(allCoinData);

        // 소켓을 통해 데이터 전송 (로그 제거)
        if (io) {
            io.emit('coinData', coinData);
        }

        return coinData;
    } catch (err: any) {
        if (err.response && err.response.status === 418) {
            logger.error(`Request failed with status code 418 for ${coinId}. Retrying in 60 seconds...`);
            setTimeout(() => fetchCoinData(coinId, io), 60000);
        } else {
            logger.error(`Error fetching coin data for ${coinId}: ${err.message}`);
            throw err;
        }
    }
};

// 코인 데이터 수집을 시작하는 함수
export const startDataCollection = (coinId: string, io?: any): void => {
    setInterval(async () => {
        try {
            await fetchCoinData(coinId, io);
        } catch (err: any) {
            logger.error(`Error in startDataCollection: ${err.message}`);
        }
    }, 1000); // 1초마다 데이터 갱신

    // 1분마다 데이터베이스 저장은 aggregateService에서 처리
};

/**
 * 히스토리 데이터 조회 (기본)
 */
export const getHistoryData = async (
    symbol: string,
    timeFrame: TimeFrame,
    limit: number = 100
): Promise<any[]> => {
    try {
        const Entity = getEntityByTimeFrame(timeFrame);
        const repository = AppDataSource.getRepository(Entity);

        const data = await repository.find({
            where: { coin_id: symbol },
            order: { createdAt: 'DESC' },
            take: limit
        });

        return data.reverse(); // 시간순 정렬
    } catch (error) {
        logger.error(`Error fetching history data: ${error}`);
        throw error;
    }
};

/**
 * 날짜 범위로 히스토리 데이터 조회
 */
export const getHistoryDataByDateRange = async (
    symbol: string,
    timeFrame: TimeFrame,
    startDate: Date,
    endDate: Date
): Promise<any[]> => {
    try {
        const Entity = getEntityByTimeFrame(timeFrame);
        const repository = AppDataSource.getRepository(Entity);

        const data = await repository
            .createQueryBuilder('data')
            .where('data.coin_id = :symbol', { symbol })
            .andWhere('data.createdAt >= :startDate', { startDate })
            .andWhere('data.createdAt <= :endDate', { endDate })
            .orderBy('data.createdAt', 'ASC')
            .getMany();

        return data;
    } catch (error) {
        logger.error(`Error fetching history data by date range: ${error}`);
        throw error;
    }
};

/**
 * 최신 데이터 조회
 */
export const getLatestData = async (
    symbol: string,
    timeFrame: TimeFrame
): Promise<any | null> => {
    try {
        const Entity = getEntityByTimeFrame(timeFrame);
        const repository = AppDataSource.getRepository(Entity);

        const data = await repository.findOne({
            where: { coin_id: symbol },
            order: { createdAt: 'DESC' }
        });

        return data;
    } catch (error) {
        logger.error(`Error fetching latest data: ${error}`);
        throw error;
    }
};