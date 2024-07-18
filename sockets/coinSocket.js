const axios = require('axios');
const { Coin } = require('../models');
const logger = require('../log/logger');
module.exports = (io) => {
    io.on('connection', (socket) => {
        logger.info('New client connected');

        // 필요한 소켓 이벤트 핸들러 추가
        socket.on('disconnect', () => {
            logger.info('Client disconnected');
        });
    });
};