module.exports = (sequelize, DataTypes) => {
    const Coin = sequelize.define('Coin', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            allowNull: false
        },
        coin_id: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        close: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        open: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        high: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        low: {
            type: DataTypes.DECIMAL(20, 10),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        }
    }, {
        tableName: 'coin',
        timestamps: true
    });

    return Coin;
};