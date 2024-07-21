'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('coin', {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        primaryKey: true
      },
      coin_id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      close: {
        type: Sequelize.DECIMAL(20, 10),
        allowNull: false
      },
      open: {
        type: Sequelize.DECIMAL(20, 10),
        allowNull: false
      },
      high: {
        type: Sequelize.DECIMAL(20, 10),
        allowNull: false
      },
      low: {
        type: Sequelize.DECIMAL(20, 10),
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('coin');
  }
};
