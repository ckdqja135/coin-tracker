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
            try {
                const { event, data } = JSON.parse(message);
                if (event === 'subscribeToCoin') {
                    logger.info(`Client subscribed to ${data}`);
                    const coinData = await fetchCoinData(data, io);
                    logger.info("coinData222 ", coinData);
                    socket.emit('coinData', coinData);
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
