const mariadb = require('mariadb');

const pool = mariadb.createPool({
    "username": "root",
    "password": "123456",
    "database": "cointable",
    "host": "127.0.0.1",
    connectionLimit: 5
});

module.exports = pool;
