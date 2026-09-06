// Vercel Serverless：注册页实时头像匹配
// GET /api/students/avatar?name=&id_number=
// 姓名学号与学生库一致且有预置照片时返回图片地址，否则 avatar 为 null
const mysql = require('mysql2/promise');
const manifest = require('../../avatars.json');

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
  const name = String((req.query && req.query.name) || '').trim();
  const idNumber = String((req.query && req.query.id_number) || '').trim();

  let avatar = null;
  if (name && idNumber) {
    const conn = await mysql.createConnection(dbConfig());
    try {
      const [rows] = await conn.query(
        'SELECT * FROM students WHERE id_number = ? LIMIT 1',
        [idNumber]
      );
      if (rows[0] && rows[0].name === name) {
        avatar = matchAvatar(name, idNumber);
      }
    } catch (e) {
      avatar = null;
    } finally {
      await conn.end();
    }
  }
  res.json({ code: 0, data: { avatar } });
};
