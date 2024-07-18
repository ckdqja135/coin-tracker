const axios = require('axios');
const { Coin } = require('../models');
const logger = require('../log/logger');

const coinDataBuffer = [];

const fetchCoinData = async (coinId, io) => {
    try {
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

        // 버퍼에 데이터 저장
        coinDataBuffer.push(coinData);

        // 로그 파일에 저장
        logger.info(`Coin Data: ${JSON.stringify(coinData)}`);

        // 콘솔을 지우고 표 형식으로 출력
        console.clear();
        console.table([{
            Timestamp: coinData.id,
            CoinName: coinData.coin_id,
            Close: coinData.close,
            Open: coinData.open,
            High: coinData.high,
            Low: coinData.low,
            Date: coinData.date
        }]);

        // 소켓을 통해 데이터 전송
        io.emit('coinData', coinData);

    } catch (err) {
        logger.error(`Error fetching coin data: ${err.message}`);
    }
};

const saveCoinDataToDB = async () => {
    try {
        if (coinDataBuffer.length > 0) {
            const latestCoinData = coinDataBuffer[coinDataBuffer.length - 1];
            await Coin.create(latestCoinData);
            coinDataBuffer.length = 0; // 버퍼 초기화
            logger.info(`Saved data to DB: ${JSON.stringify(latestCoinData)}`);
        }
    } catch (err) {
        logger.error(`Error saving coin data to DB: ${err.message}`);
    }
};

const startDataCollection = (coinId, io) => {
    // 코인 데이터를 10초마다 가져오는 함수 실행
    fetchCoinData(coinId, io);
    setInterval(() => fetchCoinData(coinId, io), 1000); // 1초마다 데이터 갱신

    // 1분마다 데이터베이스에 저장
    setInterval(saveCoinDataToDB, 60000);
};

module.exports = {
    fetchCoinData,
    saveCoinDataToDB,
    startDataCollection
};
