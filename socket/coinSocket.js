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
        socket.on('subscribeToCoin', (coinId) => {
            logger.info(`Client subscribed to ${coinId}`);

            const fetchDataAndEmit = async () => {
                try {
                    const coinData = await fetchCoinData(coinId);
                    socket.emit('coinData', coinData); // 구독한 클라이언트에게만 데이터 전송
                } catch (err) {
                    logger.error(`Error fetching coin data for ${coinId}: ${err.message}`);
                }
            };

            // 처음 데이터를 가져오고 전송
            fetchDataAndEmit();

            // 주기적으로 데이터를 가져오고 전송
            const intervalId = setInterval(fetchDataAndEmit, 1000); // 1초마다 데이터 가져오기

            // 클라이언트가 연결 해제 시 interval을 정리
            socket.on('disconnect', () => {
                clearInterval(intervalId);
                logger.info('user disconnected and interval cleared');
            });
        });
    });
};

module.exports = {
    coinSocket
};
