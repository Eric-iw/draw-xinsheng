import pool from '../config/db';
import type { Student } from '../models/types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const studentService = {
  async findAll(): Promise<Student[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM students ORDER BY id ASC'
    );
    return rows as Student[];
  },

  async findByIdNumber(idNumber: string): Promise<Student | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM students WHERE id_number = ?',
      [String(idNumber).trim()]
    );
    return (rows as Student[])[0] || null;
  },

  async create(data: Pick<Student, 'name' | 'id_number' | 'class'>): Promise<Student> {
    const { name, id_number, class: className } = data;
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO students (name, id_number, class) VALUES (?, ?, ?)',
      [name, String(id_number).trim(), className || '']
    );
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM students WHERE id = ?', [
      result.insertId,
    ]);
    return (rows as Student[])[0];
  },

  // 批量导入：INSERT IGNORE，重复学号自动跳过
  async bulkCreate(list: Pick<Student, 'name' | 'id_number' | 'class'>[]): Promise<number> {
    if (!list.length) return 0;
    const values = list.map((s) => [s.name, String(s.id_number).trim(), s.class || '']);
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO students (name, id_number, class) VALUES ?',
      [values]
    );
    return result.affectedRows;
  },

  async remove(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM students WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async clearAll(): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM students');
    return result.affectedRows;
  },

  // 查询尚未录入的学生（LEFT JOIN，单次查询，减少并发竞态窗口）
  async findNotRegistered(): Promise<Student[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.* FROM students s
       LEFT JOIN participants p ON p.id_number = s.id_number
       WHERE p.id IS NULL
       ORDER BY s.id ASC`
    );
    return rows as Student[];
  },
};
