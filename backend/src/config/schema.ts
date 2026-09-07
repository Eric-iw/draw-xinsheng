import pool from './db';

/**
 * 启动时自动建表（IF NOT EXISTS），无需手动执行 SQL。
 * - students：学生库（录入白名单，含班级）
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
    CREATE TABLE IF NOT EXISTS preset_winners (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      id_number   VARCHAR(30)  NOT NULL COMMENT '拟定中奖学号',
      created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_preset_id_number (id_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拟定中奖人';
  `);
}
