import pool from '../config/db';
import type { Winner, DrawResult } from '../models/types';
import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';

interface EligibleRow {
  id: number;
  name: string;
  id_number: string;
  avatar: string;
  class: string | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const winnerService = {
  /**
   * 抽奖：已录入且未中奖的参与者中抽取 count 人。
   * - 拟定中奖人（preset_winners）优先且按拟定顺序
   * - 剩余名额从可抽取池中随机补齐
   * - 已中奖者不会再次中奖（LEFT JOIN winners 过滤）
   * - 事务内写入 winners 并清除已中奖的拟定，返回本轮中奖名单（含班级）
   */
  async draw(count: number): Promise<{ round_no: number; winners: DrawResult[] }> {
    const conn: PoolConnection = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 可抽取池：已录入（participants）且未中奖
      const [eligibleRows] = await conn.query<RowDataPacket[]>(
        `SELECT p.id, p.name, p.id_number, p.avatar, s.class AS class
         FROM participants p
         LEFT JOIN winners w ON w.participant_id = p.id
         LEFT JOIN students s ON s.id_number = p.id_number AND s.name = p.name
         WHERE w.id IS NULL
         FOR UPDATE`
      );
      const eligible = eligibleRows as EligibleRow[];

      // 拟定中奖人：已录入、未中奖，按拟定顺序
      const [presetRows] = await conn.query<RowDataPacket[]>(
        `SELECT p.id, p.name, p.id_number, p.avatar, s.class AS class
         FROM preset_winners pw
         JOIN participants p ON p.id_number = pw.id_number
         LEFT JOIN winners w ON w.participant_id = p.id
         LEFT JOIN students s ON s.id_number = p.id_number AND s.name = p.name
         WHERE w.id IS NULL
         ORDER BY pw.id ASC
         FOR UPDATE`
      );
      const presets = presetRows as EligibleRow[];

      const presetIds = new Set(presets.map((p) => p.id));
      const remaining = shuffle(eligible.filter((p) => !presetIds.has(p.id)));
      const picked = [...presets, ...remaining].slice(0, Math.max(0, count));

      if (picked.length === 0) {
        await conn.commit();
        return { round_no: 0, winners: [] };
      }

      const [roundRows] = await conn.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(round_no), 0) + 1 AS next FROM winners'
      );
      const roundNo = (roundRows[0] as { next: number }).next;

      const values = picked.map((p) => [
        p.id,
        p.name,
        p.id_number,
        p.avatar || '/avatar.png',
        roundNo,
      ]);
      await conn.query<ResultSetHeader>(
        'INSERT INTO winners (participant_id, name, id_number, avatar, round_no) VALUES ?',
        [values]
      );

      // 清除已中奖的拟定记录
      const wonNumbers = picked.map((p) => p.id_number);
      await conn.query('DELETE FROM preset_winners WHERE id_number IN (?)', [wonNumbers]);

      await conn.commit();

      return {
        round_no: roundNo,
        winners: picked.map((p) => ({
          participant_id: p.id,
          name: p.name,
          id_number: p.id_number,
          avatar: p.avatar || '/avatar.png',
          round_no: roundNo,
          class: p.class || '',
        })),
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async findAll(): Promise<Winner[]> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM winners ORDER BY round_no ASC, id ASC');
    return rows as Winner[];
  },

  async findByRound(roundNo: number): Promise<Winner[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM winners WHERE round_no = ? ORDER BY id ASC',
      [roundNo]
    );
    return rows as Winner[];
  },

  async getCurrentRound(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT MAX(round_no) AS max FROM winners'
    );
    const max = (rows[0] as { max: number | null }).max;
    return (max ?? 0) + 1;
  },

  async recordWinner(data: Omit<Winner, 'id' | 'created_at'>): Promise<Winner> {
    const { participant_id, name, id_number, avatar, round_no } = data;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO winners (participant_id, name, id_number, avatar, round_no)
       VALUES (?, ?, ?, ?, ?)`,
      [participant_id, name, id_number, avatar || '/avatar.png', round_no]
    );
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM winners WHERE id = ?', [result.insertId]);
    return (rows as Winner[])[0];
  },

  async clearAll(): Promise<void> {
    await pool.query('TRUNCATE TABLE winners');
  },
};
