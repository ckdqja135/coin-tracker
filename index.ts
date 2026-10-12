import 'reflect-metadata';
import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AppDataSource } from './config/data-source';
import apiRoutes from './route/index';
import { coinSocket } from './socket/coinSocket';
import logger from './log/logger';
import { fetchAllCoinSymbols, startDataCollection } from './service/coinService';
import { registerAggregateTimers } from './service/aggregateService';
import { startTradeAggregator } from './service/tradeAggregator';
import { startDominanceRecorder } from './service/dominanceRecorder';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

// 미들웨어 설정
app.use(express.json());
// REST API 라우터 설정 - 통합 라우터 사용
app.use('/api', apiRoutes);

// 배포용: 웹 빌드 결과(coin-tracker-web/build)가 있으면 화면도 이 서버가 함께 내려준다.
// /api 외의 경로는 모두 index.html로 보내 React Router가 처리하게 한다.
const WEB_BUILD = path.join(__dirname, 'coin-tracker-web', 'build');
if (fs.existsSync(path.join(WEB_BUILD, 'index.html'))) {
    app.use(express.static(WEB_BUILD, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/|\/socket\.io\/).*/, (_req, res) => res.sendFile(path.join(WEB_BUILD, 'index.html')));
    logger.info(`Serving web build from ${WEB_BUILD}`);
}

// 소켓 연결 설정
coinSocket(io);

// 서버 시작 및 주기적 데이터 갱신
const PORT = process.env.PORT || 3000;
const serverStartTime = new Date();

// 시장 데이터 API(/api/market)는 DB 없이 동작하므로 DB 연결 여부와 무관하게 서버를 띄운다.
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    // 롱/숏 페이지용 실시간 체결 집계 (DB 불필요)
    startTradeAggregator();
    // BTC 도미넌스 추이 기록 (data/btc-dominance.json)
    startDominanceRecorder();
});

// 바이낸스를 1초마다 호출해 DB에 쌓는 예전 수집기. 지금 화면에서는 쓰지 않으므로 기본은 끈다.
// 필요하면 ENABLE_DB_COLLECTOR=true 로 켠다.
const ENABLE_DB_COLLECTOR = process.env.ENABLE_DB_COLLECTOR === 'true';

AppDataSource.initialize().then(async () => {
    logger.info('Database connected');

    if (!ENABLE_DB_COLLECTOR) {
        logger.info('DB collector disabled (set ENABLE_DB_COLLECTOR=true to enable)');
        return;
    }

    // 집계 타이머 등록
    registerAggregateTimers(serverStartTime);

    // 주기적인 데이터 수집 시작
    try {
        const coinIds = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
        coinIds.forEach(coinId => {
            startDataCollection(coinId, io);
        });
    } catch (err) {
        logger.error(`Error fetching coin symbols: ${err instanceof Error ? err.message : String(err)}`);
    }
}).catch(error => logger.error(`Error connecting to the database (history API disabled): ${error.message}`));
