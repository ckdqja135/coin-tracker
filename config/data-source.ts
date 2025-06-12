import { DataSource } from 'typeorm';
import { Coin } from '../models/coin';
import { tb_5min } from '../models/tb_5min';
import { tb_hour } from '../models/tb_hour';
import { tb_day } from '../models/tb_day';
import { tb_month } from '../models/tb_month';

export const AppDataSource = new DataSource({
    type: 'mariadb', // 또는 'mysql'
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_DATABASE || 'test',
    synchronize: true, // 개발 환경에서만 true로 설정, 운영 환경에서는 false로 설정
    logging: false,
    entities: [Coin, tb_5min, tb_hour, tb_day, tb_month], // entity 파일을 여기에 추가
    migrations: [],
    subscribers: [],
});