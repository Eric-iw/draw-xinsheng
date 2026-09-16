// Vercel Serverless：学生录入
// 校验规则：学号必须在学生库 + 姓名匹配 + 学号不可重复（DB 唯一约束兜底）
// 高并发优化：模块级连接池复用于热启动实例，避免每次请求新建连接
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
  return hit ? `/uploads/stuimg/${hit}` : null;
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
      connectionLimit: 10,   // 单实例最多 10 条连接，Vercel 多实例横向扩展
      queueLimit: 100,        // 排队等待连接的请求数上限
      acquireTimeout: 8000,   // 等连接超时 8s
    });
  }
  return pool;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ code: 1, msg: 'Method Not Allowed' });
    return;
  }

  const name = String((req.body && req.body.name) || '').trim();
  const id_number = String((req.body && req.body.id_number) || '').trim();
  if (!name || !id_number) {
    res.status(400).json({ code: 1, msg: '姓名和学号必填' });
    return;
  }

  const conn = await getPool().getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT name FROM students WHERE id_number = ? LIMIT 1',
      [id_number]
    );
    const student = rows[0];
    if (!student) {
      res.status(403).json({ code: 1, msg: '学号不存在于学生库，无法录入，请联系管理员' });
      return;
    }
    if (student.name !== name) {
      res.status(403).json({ code: 1, msg: '姓名和学号不匹配，请检查后重新填写' });
      return;
    }

    const avatar = matchAvatar(name, id_number) || '/avatar.png';
    try {
      const [r] = await conn.query(
        'INSERT INTO participants (name, id_number, avatar) VALUES (?, ?, ?)',
        [name, id_number, avatar]
      );
      res.json({
        code: 0,
        data: { id: r.insertId, name, id_number, avatar, created_at: new Date() },
      });
    } catch (e) {
      // 唯一约束冲突：并发重复提交时第二个请求走这里，不会产生重复数据
      if (e.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ code: 1, msg: '该学号已录入，请勿重复提交' });
        return;
      }
      throw e;
    }
  } catch (e) {
    res.status(500).json({ code: 1, msg: '服务未开启，请稍后再试' });
  } finally {
    conn.release();
  }
};
