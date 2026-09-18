// Vercel Serverless：录入控制中转
// 手机控制页 ↔ 桌面 AdminPage（与 lottery.js 同模式：数据库中转指令+结果）
// GET  /api/stats — 返回最新的录入统计数据 + 录入指令
// POST /api/stats — 发送录入指令或上报录入结果/统计数据
const mysql = require('mysql2/promise');

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

async function getSetting(key) {
  const [rows] = await getPool().query('SELECT svalue FROM settings WHERE skey = ?', [key]);
  return rows[0] ? String(rows[0].svalue) : null;
}

async function setSetting(key, value) {
  await getPool().query(
    'INSERT INTO settings (skey, svalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)',
    [key, value]
  );
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
      const [cmdRaw, statsRaw, resultRaw] = await Promise.all([
        getSetting('register_cmd'),
        getSetting('register_stats'),
        getSetting('register_result'),
      ]);
      res.json({
        code: 0,
        data: {
          command: cmdRaw ? JSON.parse(cmdRaw) : null,
          stats: statsRaw ? JSON.parse(statsRaw) : null,
          result: resultRaw ? JSON.parse(resultRaw) : null,
        },
      });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};

      // action=cmd：控制页发送录入指令
      if (body.action === 'cmd') {
        const payload = { cmd: body.cmd, ts: Date.now() };
        await setSetting('register_cmd', JSON.stringify(payload));
        res.json({ code: 0, data: { ok: true } });
        return;
      }

      // action=result：AdminPage 上报录入结果
      if (body.action === 'result') {
        await setSetting('register_result', JSON.stringify(body.result));
        res.json({ code: 0, data: { ok: true } });
        return;
      }

      // action=stats：AdminPage 上报录入统计数据
      if (body.action === 'stats') {
        await setSetting('register_stats', JSON.stringify(body.stats));
        res.json({ code: 0, data: { ok: true } });
        return;
      }

      res.status(400).json({ code: 1, msg: 'Unknown action' });
      return;
    }

    res.status(405).json({ code: 1, msg: 'Method Not Allowed' });
  } catch (e) {
    console.error('stats API error:', e);
    res.status(500).json({ code: 1, msg: '服务未开启，请稍后再试' });
  }
};