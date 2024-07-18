const axios = require('axios');
const { Coin } = require('../models');
const logger = require('../log/logger');

// 최신 코인 데이터를 저장하는 버퍼
const coinDataBuffer = {};

// 코인 데이터를 Binance API에서 가져오는 함수
const fetchCoinData = async (coinId, io) => {
    try {
        // Binance API에서 24시간 코인 데이터를 가져옴
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coinId}`);
        const data = response.data;
        const timestamp = Date.now(); // 밀리초 단위로 timestamp 설정
        const coinData = {
            id: timestamp, // id를 timestamp 밀리초 값으로 설정
            coin_id: coinId,
            close: parseFloat(data.lastPrice),
            open: parseFloat(data.openPrice),
            high: parseFloat(data.highPrice),
            low: parseFloat(data.lowPrice),
            date: new Date(timestamp).toLocaleString()
        };

        // 최신 데이터를 버퍼에 저장
        coinDataBuffer[coinId] = coinData;

        // 로그 파일에 저장
        logger.info(`Coin Data: ${JSON.stringify(coinData)}`);

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

        // 소켓을 통해 데이터 전송
        io.emit('coinData', coinData);

    } catch (err) {
        // 오류 발생 시 로그에 기록
        logger.error(`Error fetching coin data for ${coinId}: ${err.message}`);
    }
};

// 최신 코인 데이터를 데이터베이스에 저장하는 함수
const saveCoinDataToDB = async () => {
    try {
        // 버퍼에 저장된 최신 코인 데이터를 배열로 변환
        const latestCoinDataArray = Object.values(coinDataBuffer);
        // 최신 코인 데이터 배열 latestCoinDataArray가 비어 있는지 확인.
        if (latestCoinDataArray.length > 0) {
            for (const latestCoinData of latestCoinDataArray) {
                // 각 최신 코인 데이터를 데이터베이스에 저장
                await Coin.create(latestCoinData);
                // 저장된 데이터를 로그에 기록
                logger.info(`Saved data to DB for ${latestCoinData.coin_id}: ${JSON.stringify(latestCoinData)}`);
            }
        }
    } catch (err) {
        // 데이터베이스 저장 중 오류 발생 시 로그에 기록
        logger.error(`Error saving coin data to DB: ${err.message}`);
    }
};

// 코인 데이터 수집을 시작하는 함수
const startDataCollection = (coinId, io) => {
    // 코인 데이터를 10초마다 가져오는 함수 실행
    fetchCoinData(coinId, io);
    setInterval(() => fetchCoinData(coinId, io), 10000); // 10초마다 데이터 갱신

    // 1분마다 데이터베이스에 저장
    setInterval(saveCoinDataToDB, 60000);
};

module.exports = {
    fetchCoinData,
    saveCoinDataToDB,
    startDataCollection
};