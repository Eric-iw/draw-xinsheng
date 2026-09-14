import pool from '../config/db';
import type { RowDataPacket } from 'mysql2/promise';

export interface AppConfig {
  maxRounds: number;
}

const DEFAULTS: AppConfig = { maxRounds: 3 };

export const settingService = {
  /** 获取系统配置（缺省项回退默认值） */
  async getConfig(): Promise<AppConfig> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT skey, svalue FROM settings WHERE skey IN ('max_rounds')"
    );
    const map = new Map<string, string>(rows.map((r) => [r.skey, String(r.svalue)]));
    const maxRoundsRaw = Number(map.get('max_rounds'));
    return {
      maxRounds: Number.isFinite(maxRoundsRaw) && maxRoundsRaw >= 1
        ? Math.floor(maxRoundsRaw)
        : DEFAULTS.maxRounds,
    };
  },

  /** 更新抽奖轮次 */
  async setMaxRounds(value: number): Promise<number> {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      throw new Error('轮次必须是 1-20 之间的整数');
    }
    await pool.query(
      `INSERT INTO settings (skey, svalue) VALUES ('max_rounds', ?)
       ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)`,
      [String(n)]
    );
    return n;
  },
};
