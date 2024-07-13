const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { sequelize, Coin } = require('./models');
const coinRoutes = require('./routes/coinRoutes');
const coinSocket = require('./sockets/coinSocket');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 미들웨어 설정
app.use(express.json());
app.use('/api/coins', coinRoutes);

// 소켓 연결 설정
coinSocket(io);

const fetchCoinData = async (coinId) => {
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
            low: parseFloat(data.lowPrice)
        };

        // 데이터베이스에 저장
        await Coin.create(coinData);

        // 콘솔에 출력
        console.log(`Coin ID: ${coinData.coin_id}`);
        console.log(`Close: ${coinData.close}`);
        console.log(`Open: ${coinData.open}`);
        console.log(`High: ${coinData.high}`);
        console.log(`Low: ${coinData.low}`);
        console.log(`Timestamp: ${new Date(timestamp).toLocaleString()}`);
    } catch (err) {
        console.error(err);
    }
};

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await sequelize.authenticate();
    console.log('Database connected');

    // 코인 데이터를 주기적으로 가져오는 함수 실행 (예: BTCUSDT)
    const coinId = 'BTCUSDT';
    fetchCoinData(coinId);
    setInterval(() => fetchCoinData(coinId), 60000); // 1분마다 데이터 갱신
});
