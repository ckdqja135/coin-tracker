const axios = require('axios');
const { Coin } = require('../models');
const logger = require('../log/logger');

// 해시맵을 전역 변수로 설정
const coinDataBuffer = {};

// Binance API에서 거래 가능한 전체 코인 목록을 가져오는 함수
const fetchAllCoinSymbols = async () => {
    try {
        const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
        return response.data.symbols.map(symbol => symbol.symbol);
    } catch (err) {
        logger.error(`Error fetching coin symbols: ${err.message}`);
        return [];
    }
};

// 코인 데이터를 Binance API에서 가져오는 함수
const fetchCoinData = async (coinId, io) => {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coinId}`);
        const data = response.data;
        const timestamp = Date.now(); // 밀리초 단위로 timestamp 설정
        const coinData = {
            id: Math.floor(timestamp / 60000) * 60000, // 분 단위로 잘라서 설정
            coin_id: coinId,
            close: parseFloat(data.lastPrice),
            open: parseFloat(data.openPrice),
            high: parseFloat(data.highPrice),
            low: parseFloat(data.lowPrice),
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
            date: new Date(timestamp).toLocaleString()
        };

        // logger.info(`coinId, ${coinId}`);
        // logger.info(`Fetched coin data: ${JSON.stringify(coinData)}`); // 추가 로그


        // 최신 데이터를 해시맵에 저장
        coinDataBuffer[coinId] = coinData;

        // 로그 파일에 저장
        // logger.info(`Coin Data: ${JSON.stringify(coinData)}`);

        // 모든 종목 데이터를 모아서 출력
        const allCoinData = Object.values(coinDataBuffer).map(data => ({
            Timestamp: data.id,
            CoinName: data.coin_id,
            Close: data.close,
            Open: data.open,
            High: data.high,
            Low: data.low,
            Date: data.date
        }));

        // 콘솔을 지우고 표 형식으로 출력
        console.clear();
        console.table(allCoinData);

        return coinData;
    } catch (err) {
        // 오류 발생 시 로그에 기록
        logger.error(`Error fetching coin data for ${coinId}: ${err.message}`);
        throw err;
    }
};

// 최신 코인 데이터를 데이터베이스에 저장하는 함수
const saveCoinDataToDB = async () => {
    try {
        // 해시맵에 저장된 최신 코인 데이터를 배열로 변환
        const latestCoinDataArray = Object.values(coinDataBuffer);
        logger.info(`latestCoinDataArray: ${JSON.stringify(latestCoinDataArray)}`);

        // 최신 코인 데이터 배열 latestCoinDataArray가 비어 있는지 확인
        if (latestCoinDataArray.length > 0) {
            // 데이터베이스에 저장 (중복 검사 후 저장)
            await Coin.bulkCreate(latestCoinDataArray, {
                updateOnDuplicate: ['id', 'coin_id', 'close', 'open', 'high', 'low', 'updatedAt']
            });

            // 모든 레코드가 삽입된 후 로그를 기록
            latestCoinDataArray.forEach(coinData => {
                logger.info(`Saved data to DB for ${coinData.coin_id}: ${JSON.stringify(coinData)}`);
            });
        }
    } catch (err) {
        logger.error(`Error saving coin data to DB: ${err.message}`);
    }
};

// 코인 데이터 수집을 시작하는 함수
const startDataCollection = (coinId, io) => {
    // 코인 데이터를 10초마다 가져오는 함수 실행
    setInterval(async () => {
        try {
            await fetchCoinData(coinId, io);
        } catch (err) {
            logger.error(`Error in startDataCollection: ${err.message}`);
        }
    }, 1000); // 1초마다 데이터 갱신

    // 1분마다 데이터베이스에 저장
    setInterval(saveCoinDataToDB, 60000);
};

// 특정 코인의 데이터를 데이터베이스에서 조회하는 함수
const getCoinDataFromDB = async (coinId) => {
    try {
        const coins = await Coin.findAll({
            where: { coin_id: coinId },
            order: [['id', 'DESC']],
            limit: 60
        });
        return coins;
    } catch (err) {
        throw new Error(`Error fetching coin data from DB: ${err.message}`);
    }
};

module.exports = {
    fetchAllCoinSymbols,
    fetchCoinData,
    saveCoinDataToDB,
    startDataCollection,
    getCoinDataFromDB
};
