// Vercel Serverless：抽奖控制 API
// 跨设备通信中转：手机控制页 ↔ 首页（桌面投影）
// 使用 settings 表存储指令和状态（键值对：lottery_cmd / lottery_state）
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
  // CORS：允许任意来源（手机/桌面/本地/部署均可访问）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // ---- GET /api/lottery ---- 返回当前状态 + 最新指令 + 配置
    if (req.method === 'GET') {
      const [stateRaw, cmdRaw, maxRoundsRaw] = await Promise.all([
        getSetting('lottery_state'),
        getSetting('lottery_cmd'),
        getSetting('max_rounds'),
      ]);
      res.json({
        code: 0,
        data: {
          state: stateRaw ? JSON.parse(stateRaw) : null,
          command: cmdRaw ? JSON.parse(cmdRaw) : null,
          maxRounds: maxRoundsRaw ? Number(maxRoundsRaw) : 3,
        },
      });
      return;
    }

    // ---- POST /api/lottery ---- 写入指令 / 状态 / 配置
    if (req.method === 'POST') {
      const body = req.body || {};

      // action=cmd：控制页发送指令（start / draw / reset / resetAll / setRound）
      if (body.action === 'cmd') {
        const payload = { cmd: body.cmd, ts: Date.now() };
        if (body.round !== undefined) payload.round = Number(body.round);
        await setSetting('lottery_cmd', JSON.stringify(payload));
        res.json({ code: 0, data: { ok: true } });
        return;
      }

      // action=state：首页上报当前状态
      if (body.action === 'state') {
        await setSetting('lottery_state', JSON.stringify(body.state));
        res.json({ code: 0, data: { ok: true } });
        return;
      }

      // action=maxRounds：修改总轮次
      if (body.action === 'maxRounds') {
        const n = Math.floor(Number(body.maxRounds));
        if (!Number.isFinite(n) || n < 1 || n > 20) {
          res.status(400).json({ code: 1, msg: '轮次必须是 1-20 之间的整数' });
          return;
        }
        await setSetting('max_rounds', String(n));
        res.json({ code: 0, data: { maxRounds: n } });
        return;
      }

      res.status(400).json({ code: 1, msg: 'Unknown action' });
      return;
    }

    res.status(405).json({ code: 1, msg: 'Method Not Allowed' });
  } catch (e) {
    console.error('lottery API error:', e);
    res.status(500).json({ code: 1, msg: '服务未开启，请稍后再试' });
  }
};
