import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AppDataSource } from './config/data-source';
import coinRoutes from './route/coinRoutes';
import { coinSocket } from './socket/coinSocket';
import logger from './log/logger';
import { fetchAllCoinSymbols, startDataCollection } from './service/coinService';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

// 미들웨어 설정
app.use(express.json());
// REST API 라우터 설정
app.use('/api/coins', coinRoutes);

// 소켓 연결 설정
coinSocket(io);

// 서버 시작 및 주기적 데이터 갱신
const PORT = process.env.PORT || 3000;
AppDataSource.initialize().then(async () => {
    logger.info('Database connected');

    server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        // 주기적인 데이터 수집 시작 코드 추가
        try {
            const coinIds = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
            coinIds.forEach(coinId => {
                startDataCollection(coinId, io);
            });
        } catch (err) {
            logger.error(`Error fetching coin symbols: ${err.message}`);
        }
    });
}).catch(error => logger.error('Error connecting to the database', error));