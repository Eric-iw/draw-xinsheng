// Vercel Serverless：学生注册
// 校验规则与本地后端一致：学号必须在学生库 + 姓名匹配 + 学号不可重复
// 头像按 姓名-学号 匹配 public/uploads/stuimg 中的预置照片（见 avatars.json）
const mysql = require('mysql2/promise');
const manifest = require('../avatars.json');

function matchAvatar(name, idNumber) {
  const list = Array.isArray(manifest) ? manifest : [manifest];
  const prefix = `${name}-${idNumber}.`;
  const hit = list.find((f) => f.startsWith(prefix));
  return hit ? `/uploads/stuimg/${hit}` : null;
}

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

  const conn = await mysql.createConnection(dbConfig());
  try {
    const [rows] = await conn.query(
      'SELECT * FROM students WHERE id_number = ? LIMIT 1',
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
      if (e.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ code: 1, msg: '该学号已录入，请勿重复提交' });
        return;
      }
      throw e;
    }
  } catch (e) {
    res.status(500).json({ code: 1, msg: '服务未开启，请稍后再试' });
  } finally {
    await conn.end();
  }
};
