import pool from '../config/db';
import type { PresetView } from '../models/types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const presetService = {
  // 列表：关联参与者（是否已录入）和学生库（姓名/班级）用于后台展示
  async findAll(): Promise<PresetView[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pw.id, pw.id_number, pw.created_at,
              p.id   AS participant_id,
              p.name AS participant_name,
              p.avatar AS avatar,
              s.name AS student_name,
              s.class AS class
       FROM preset_winners pw
       LEFT JOIN participants p ON p.id_number = pw.id_number
       LEFT JOIN students s ON s.id_number = pw.id_number
       ORDER BY pw.id ASC`
    );
    return rows as PresetView[];
  },

  async add(idNumber: string): Promise<void> {
    await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO preset_winners (id_number) VALUES (?)',
      [String(idNumber).trim()]
    );
  },

  async remove(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM preset_winners WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  },

  async clear(): Promise<void> {
    await pool.query('DELETE FROM preset_winners');
  },
};
