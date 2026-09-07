import { Router, Request, Response } from 'express';
import { studentService } from '../services/studentService';
import { matchAvatar, listAvatarFiles } from '../utils/avatar';

const router = Router();

// GET /api/students — 学生库列表（附带头像匹配结果：avatar 为 null 表示 stuimg 中无对应图片）
router.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await studentService.findAll();
    res.json({
      code: 0,
      data: list.map((s) => ({ ...s, avatar: matchAvatar(s.name, s.id_number) })),
    });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// GET /api/students/avatar-manifest — stuimg 预置头像文件名清单
// 注册页打开时拉取一次，之后在浏览器本地按 姓名-学号 即时匹配，不再逐字查库
router.get('/avatar-manifest', (_req: Request, res: Response) => {
  res.json({ code: 0, data: { files: listAvatarFiles() } });
});

// POST /api/students — 新增单个学生
router.post('/', async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    const id_number = String(req.body.id_number || '').trim();
    const className = String(req.body.class || '').trim();
    if (!name || !id_number) {
      res.status(400).json({ code: 1, msg: '姓名和学号必填' });
      return;
    }
    const s = await studentService.create({ name, id_number, class: className });
    res.json({ code: 0, data: s });
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      res.status(409).json({ code: 1, msg: '该学号已存在于学生库' });
      return;
    }
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// POST /api/students/bulk — 批量导入（数组，重复学号自动跳过）
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const list = req.body as { name: string; id_number: string; class?: string }[];
    if (!Array.isArray(list)) {
      res.status(400).json({ code: 1, msg: 'body 必须是数组' });
      return;
    }
    const valid = list
      .map((i) => ({
        name: String(i.name || '').trim(),
        id_number: String(i.id_number || '').trim(),
        class: String(i.class || '').trim(),
      }))
      .filter((i) => i.name && i.id_number);
    const affected = await studentService.bulkCreate(valid);
    res.json({ code: 0, data: { affected, total: valid.length } });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// DELETE /api/students — 清空学生库
router.delete('/', async (_req: Request, res: Response) => {
  try {
    const affected = await studentService.clearAll();
    res.json({ code: 0, data: { affected } });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// DELETE /api/students/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ok = await studentService.remove(Number(req.params.id));
    res.json({ code: 0, data: ok });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

export default router;
