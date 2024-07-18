const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { sequelize } = require('./models');
const coinRoutes = require('./routes/coinRoutes');
const coinSocket = require('./sockets/coinSocket');
const logger = require('./log/logger');  // 로거 모듈 경로 수정
const { fetchCoinData, saveCoinDataToDB, startDataCollection } = require('./services/coinService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 미들웨어 설정
app.use(express.json());
app.use('/api/coins', coinRoutes);

// 소켓 연결 설정
coinSocket(io);

// 서버 시작 및 주기적 데이터 갱신
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    logger.info(`Server running on port ${PORT}`);
    await sequelize.authenticate();
    logger.info('Database connected');

    const coinId = 'BTCUSDT';

    // 주기적인 데이터 수집 시작
    startDataCollection(coinId, io);
});