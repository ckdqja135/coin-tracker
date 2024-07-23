const { getCoinDataFromDB, fetchAllCoinSymbols } = require('../service/coinService');

// 1분 단위 코인 데이터 조회
const getCoinData = async (req, res) => {
    const { coinId } = req.params;
    try {
        const coins = await getCoinDataFromDB(coinId);
        res.json(coins);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 전체 코인 목록을 가져오는 엔드포인트
const getAllCoinSymbols = async (req, res) => {
    const coinSymbols = await fetchAllCoinSymbols();
    res.json(coinSymbols);
};

module.exports = {
    getCoinData,
    getAllCoinSymbols
};
