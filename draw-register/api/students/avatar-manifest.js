// Vercel Serverless：stuimg 预置头像文件名清单
// GET /api/students/avatar-manifest
// 注册页打开时拉取一次，之后在浏览器本地按 姓名-学号 即时匹配头像，不再逐字请求
const manifest = require('../../avatars.json');

module.exports = (_req, res) => {
  const files = Array.isArray(manifest) ? manifest : [manifest];
  res.status(200).json({ code: 0, data: { files } });
};
