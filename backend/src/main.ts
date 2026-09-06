import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import pool from './config/db';
import { ensureTables } from './config/schema';

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
  // 测试数据库连接
  try {
    await pool.getConnection();
    console.log('[DB] MySQL 连接成功');
  } catch (err) {
    console.error('[DB] MySQL 连接失败，请先执行 backend/src/sql/init.sql 建库建表');
    console.error(err);
    process.exit(1);
  }

  // 自动创建新增表（students / preset_winners）
  try {
    await ensureTables();
    console.log('[DB] 数据表检查完成');
  } catch (err) {
    console.error('[DB] 自动建表失败:', err);
  }

  app.listen(PORT, () => {
    console.log(`[Server] 抽奖后端启动: http://localhost:${PORT}`);
  });
}

bootstrap();
