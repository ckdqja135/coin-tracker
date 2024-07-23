const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { sequelize } = require('./models');
const coinRoutes = require('./route/coinRoutes'); // 경로 수정
const { coinSocket } = require('./socket/coinSocket');
const logger = require('./log/logger');
const { fetchAllCoinSymbols, startDataCollection } = require('./service/coinService'); // startDataCollection 추가

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 미들웨어 설정
app.use(express.json());
// REST API 라우터 설정
app.use('/api/coins', coinRoutes);

// 소켓 연결 설정
coinSocket(io);

// 서버 시작 및 주기적 데이터 갱신
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    logger.info(`Server running on port ${PORT}`);
    await sequelize.authenticate();
    logger.info('Database connected');

    // Binance API에서 전체 코인 목록을 가져와 주기적인 데이터 수집 시작
    try {
        // const coinIds = await fetchAllCoinSymbols();
        // logger.info(`Fetched ${coinIds.length} coin symbols from Binance`);
        const coinIds = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
        // 각 종목에 대해 주기적인 데이터 수집 시작
        coinIds.forEach(coinId => {
            startDataCollection(coinId, io);
        });
    } catch (err) {
        logger.error(`Error fetching coin symbols: ${err.message}`);
    }
});
