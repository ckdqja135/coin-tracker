const axios = require('axios');
const { Coin } = require('../models');

const fetchCoinData = async (coinId) => {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coinId}`);
        const data = response.data;
        const coinData = {
            coin_id: coinId,
            close: parseFloat(data.lastPrice),
            open: parseFloat(data.openPrice),
            high: parseFloat(data.highPrice),
            low: parseFloat(data.lowPrice),
            timestamp: new Date()
        };

        // 데이터베이스에 저장
        await Coin.create(coinData);

        // 콘솔에 출력
        console.log(`Coin ID: ${coinData.coin_id}`);
        console.log(`Close: ${coinData.close}`);
        console.log(`Open: ${coinData.open}`);
        console.log(`High: ${coinData.high}`);
        console.log(`Low: ${coinData.low}`);
        console.log(`Timestamp: ${coinData.timestamp.toLocaleString()}`);
    } catch (err) {
        console.error(err);
    }
};

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected');

        // 클라이언트에서 특정 코인 데이터를 요청할 때
        socket.on('requestCoinData', (coinId) => {
            fetchCoinData(coinId);
            setInterval(() => fetchCoinData(coinId), 60000); // 1분마다 데이터 갱신
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });
};
