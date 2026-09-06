// Vercel Serverless：学生名册（注册页拉取一次后在本地按 姓名+学号 匹配班级）
// GET /api/students
const mysql = require('mysql2/promise');

function dbConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2' },
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ code: 1, msg: 'Method Not Allowed' });
    return;
  }
  const conn = await mysql.createConnection(dbConfig());
  try {
    const [rows] = await conn.query(
      'SELECT id, name, id_number, class FROM students ORDER BY id ASC'
    );
    res.status(200).json({ code: 0, data: rows });
  } catch (e) {
    res.status(500).json({ code: 1, msg: '服务未开启，请稍后再试' });
  } finally {
    await conn.end();
  }
};
