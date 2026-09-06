import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import apiRoutes from './routes';

const app = express();

app.use(cors());
app.use(express.json());

// 头像等静态资源目录：backend/uploads（其中 stuimg/ 为管理员预置的学生头像）
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
fs.mkdirSync(path.join(UPLOADS_DIR, 'stuimg'), { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.use('/api', apiRoutes);

export default app;
