import pool from '../config/db';
import type { Participant } from '../models/types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const participantService = {
  async findAll(): Promise<Participant[]> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM participants ORDER BY id ASC');
    return rows as Participant[];
  },

  async findById(id: number): Promise<Participant | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM participants WHERE id = ?', [id]);
    return (rows as Participant[])[0] || null;
  },

  async create(data: Omit<Participant, 'id' | 'created_at'>): Promise<Participant> {
    const { name, id_number, avatar } = data;
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO participants (name, id_number, avatar) VALUES (?, ?, ?)',
      [name, id_number, avatar || '/avatar.png']
    );
    return (await this.findById(result.insertId)) as Participant;
  },

  async bulkCreate(list: Omit<Participant, 'id' | 'created_at'>[]): Promise<number> {
    if (!list.length) return 0;
    const values = list.map((p) => [p.name, p.id_number, p.avatar || '/avatar.png']);
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO participants (name, id_number, avatar) VALUES ?',
      [values]
    );
    return result.affectedRows;
  },

  async remove(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM participants WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async clearAll(): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM participants');
    return result.affectedRows;
  },

  async count(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM participants');
    return (rows[0] as { cnt: number }).cnt;
  },
};
