import axios from 'axios';
import { AppDataSource } from '../config/data-source';
import { Coin } from '../models/coin';
import logger from '../log/logger';

// 해시맵을 전역 변수로 설정
const coinDataBuffer: { [key: string]: any } = {};

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

        // 소켓을 통해 데이터 전송
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

// 최신 코인 데이터를 데이터베이스에 저장하는 함수
export const saveCoinDataToDB = async (): Promise<void> => {
    try {
        const latestCoinDataArray = Object.values(coinDataBuffer);

        if (latestCoinDataArray.length > 0) {
            const coinRepository = AppDataSource.getRepository(Coin);
            await coinRepository.save(latestCoinDataArray, { chunk: 100 });

            logger.info(`DB 저장 완료: ${latestCoinDataArray.length}개 코인 데이터`);
        }
    } catch (err: any) {
        logger.error(`Error saving coin data to DB: ${err.message}`);
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

    setInterval(saveCoinDataToDB, 60000); // 1분마다 데이터베이스에 저장
};

// 특정 코인의 데이터를 데이터베이스에서 조회하는 함수
export const getCoinDataFromDB = async (coinId: string): Promise<Coin[]> => {
    try {
        const coinRepository = AppDataSource.getRepository(Coin);
        const coins = await coinRepository.find({
            where: { coin_id: coinId },
            order: { id: 'DESC' },
            take: 60
        });
        return coins;
    } catch (err: any) {
        throw new Error(`Error fetching coin data from DB: ${err.message}`);
    }
};