// Vercel Serverless：录入统计 + 一键全部录入
// GET  /api/stats — 返回学生库总数、已录入数、未录入数
// POST /api/stats — 一键全部录入（INSERT IGNORE 幂等）
const mysql = require('mysql2/promise');
let manifest = [];
try {
  const loaded = require('../avatars.json');
  manifest = Array.isArray(loaded) ? loaded : (loaded ? [loaded] : []);
} catch (e) {
  manifest = [];
}

function matchAvatar(name, idNumber) {
  const prefix = `${name}-${idNumber}.`;
  const hit = manifest.find((f) => typeof f === 'string' && f.startsWith(prefix));
  return hit ? `/uploads/stuimg/${hit}` : '/avatar.png';
}

let pool = null;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 4000),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2' },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 100,
      acquireTimeout: 8000,
    });
  }
  return pool;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const p = getPool();
      const [[stuRow], [partRow]] = await Promise.all([
        p.query('SELECT COUNT(*) AS cnt FROM students'),
        p.query('SELECT COUNT(*) AS cnt FROM participants'),
      ]);
      const totalStudents = stuRow[0].cnt;
      const registered = partRow[0].cnt;
      res.json({
        code: 0,
        data: { totalStudents, registered, notRegistered: totalStudents - registered },
      });
      return;
    }

    if (req.method === 'POST') {
      const p = getPool();
      // LEFT JOIN 查出未录入学生
      const [rows] = await p.query(
        `SELECT s.name, s.id_number
         FROM students s
         LEFT JOIN participants p ON s.id_number = p.id_number
         WHERE p.id IS NULL`
      );
      if (rows.length === 0) {
        res.json({ code: 0, data: { affected: 0, total: 0 } });
        return;
      }
      const values = rows.map((s) => [s.name, s.id_number, matchAvatar(s.name, s.id_number)]);
      // INSERT IGNORE 幂等
      const [r] = await p.query(
        'INSERT IGNORE INTO participants (name, id_number, avatar) VALUES ?',
        [values]
      );
      res.json({ code: 0, data: { affected: r.affectedRows, total: values.length } });
      return;
    }

    res.status(405).json({ code: 1, msg: 'Method Not Allowed' });
  } catch (e) {
    console.error('stats API error:', e);
    res.status(500).json({ code: 1, msg: '服务未开启，请稍后再试' });
  }
};