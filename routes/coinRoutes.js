const express = require('express');
const router = express.Router();
const { Coin } = require('../models');

// 1분 단위 코인 데이터 조회
router.get('/:coinId', async (req, res) => {
    const { coinId } = req.params;
    try {
        const coins = await Coin.findAll({
            where: { coin_id: coinId },
            order: [['timestamp', 'DESC']],
            limit: 60
        });
        res.json(coins);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
