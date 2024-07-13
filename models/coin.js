'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Coin extends Model {
        static associate(models) {
            // define association here
        }
    };
    Coin.init({
        id: {
            type: DataTypes.BIGINT, // id를 bigint로 설정
            primaryKey: true,
            allowNull: false
        },
        coin_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        close: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false
        },
        open: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false
        },
        high: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false
        },
        low: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'Coin',
        tableName: 'coin',
        timestamps: true // createdAt과 updatedAt을 사용
    });
    return Coin;
};
