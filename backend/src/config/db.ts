import mysql, { Pool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'draw_lottery',
  // TiDB Cloud 等云数据库要求 SSL（.env 设 DB_SSL=true 开启）；本地 MySQL 不设或设 false
  ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' as const } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
