const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected to server');

    // 구독 메시지 전송
    socket.emit('subscribeToCoin', 'BTCUSDT');
    console.log('Sent subscribeToCoin event for BTCUSDT');
});

socket.on('coinData', (data) => {
    console.log(`Received coin data: ${JSON.stringify(data)}`);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});
