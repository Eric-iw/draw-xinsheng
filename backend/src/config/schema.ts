import pool from './db';

/**
 * 启动时自动建表（IF NOT EXISTS），无需手动执行 SQL。
 * - students：学生库（录入白名单，含班级）
 * - participants：已录入参与者（学号唯一，防重复录入）
 * - winners：中奖记录
 * - preset_winners：拟定中奖人（后台指定下一轮中奖学号）
 */
export async function ensureTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(50)  NOT NULL COMMENT '姓名',
      id_number   VARCHAR(30)  NOT NULL COMMENT '学号',
      class       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '班级',
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_student_id_number (id_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生库（录入白名单）';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS participants (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(50)  NOT NULL COMMENT '姓名',
      id_number   VARCHAR(30)  NOT NULL COMMENT '学号',
      avatar      VARCHAR(255) NOT NULL DEFAULT '/avatar.png' COMMENT '头像',
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_participant_id_number (id_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='已录入参与者';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS winners (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(50)  NOT NULL COMMENT '姓名',
      id_number   VARCHAR(30)  NOT NULL COMMENT '学号',
      avatar      VARCHAR(255) NOT NULL DEFAULT '/avatar.png' COMMENT '头像',
      round_no    INT          NOT NULL COMMENT '中奖轮次',
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_winner_id_number (id_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='中奖记录';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS preset_winners (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      id_number   VARCHAR(30)  NOT NULL COMMENT '拟定中奖学号',
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_preset_id_number (id_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拟定中奖人';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      skey        VARCHAR(50)  NOT NULL PRIMARY KEY COMMENT '配置键',
      svalue      VARCHAR(255) NOT NULL COMMENT '配置值',
      updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置（键值对）';
  `);

  // 默认抽奖轮次为 3（仅在首次启动时写入，不覆盖管理员配置）
  await pool.query(
    `INSERT IGNORE INTO settings (skey, svalue) VALUES ('max_rounds', '3')`
  );
}
