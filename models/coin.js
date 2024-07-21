module.exports = (sequelize, DataTypes) => {
    const Coin = sequelize.define('Coin', {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true
        },
        coin_id: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
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
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
        }
    }, {
        tableName: 'coin',
        timestamps: true
    });

    return Coin;
};
