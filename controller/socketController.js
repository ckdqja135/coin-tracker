const { fetchCoinData } = require('../service/coinService');
const logger = require('../log/logger');

// 소켓 연결 설정 함수
const coinSocket = (io) => {
    io.on('connection', (socket) => {
        logger.info('a user connected');

        socket.on('disconnect', () => {
            logger.info('user disconnected');
        });

        // 클라이언트가 특정 코인에 구독(subscribe)하는 이벤트 처리
        socket.on('message', async (message) => {
            logger.info(`Received message: ${message}`);
            try {
                const parsedMessage = JSON.parse(message);
                logger.info(`Parsed message: ${JSON.stringify(parsedMessage)}`);
                const { event, data } = parsedMessage;

                if (event === 'subscribeToCoin') {
                    logger.info(`Event: ${event}`);
                    logger.info(`Client subscribed to ${data}`);
                    const coinData = await fetchCoinData(data, io);
                    logger.info(`Fetched coin data: ${JSON.stringify(coinData)}`);
                    socket.emit('coinData', coinData); // 클라이언트로 데이터 전송
                } else {
                    logger.info(`Unknown event: ${event}`);
                }
            } catch (err) {
                logger.error(`Error in socket message handler: ${err.message}`);
            }
        });
    });
};

module.exports = {
    coinSocket
};
