import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AppDataSource } from './config/data-source';
import apiRoutes from './route/index';
import { coinSocket } from './socket/coinSocket';
import logger from './log/logger';
import { fetchAllCoinSymbols, startDataCollection } from './service/coinService';
import { registerAggregateTimers } from './service/aggregateService';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

// 미들웨어 설정
app.use(express.json());
// REST API 라우터 설정 - 통합 라우터 사용
app.use('/api', apiRoutes);

// 소켓 연결 설정
coinSocket(io);

// 서버 시작 및 주기적 데이터 갱신
const PORT = process.env.PORT || 3000;
const serverStartTime = new Date();

AppDataSource.initialize().then(async () => {
    logger.info('Database connected');

    // 집계 타이머 등록
    registerAggregateTimers(serverStartTime);

    server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        // 주기적인 데이터 수집 시작 코드 추가
        try {
            const coinIds = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
            coinIds.forEach(coinId => {
                startDataCollection(coinId, io);
            });
        } catch (err) {
            logger.error(`Error fetching coin symbols: ${err instanceof Error ? err.message : String(err)}`);
        }
    });
}).catch(error => logger.error('Error connecting to the database', error));