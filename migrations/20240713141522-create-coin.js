'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('coin', {
      id: {
        type: Sequelize.BIGINT, // id를 bigint로 설정
        allowNull: false,
        primaryKey: true
      },
      coin_id: {
        type: Sequelize.STRING,
        allowNull: false
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
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('coin');
  }
};