import { Router, Request, Response } from 'express';
import { studentService } from '../services/studentService';
import { matchAvatar } from '../utils/avatar';

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

// GET /api/students/avatar?name=&id_number= — 注册页实时匹配头像
// 姓名学号与学生库一致才返回匹配到的预置头像（avatar 为 null 表示无图/不一致）
router.get('/avatar', async (req: Request, res: Response) => {
  try {
    const name = String(req.query.name || '').trim();
    const idNumber = String(req.query.id_number || '').trim();
    let avatar: string | null = null;
    if (name && idNumber) {
      const student = await studentService.findByIdNumber(idNumber);
      if (student && student.name === name) {
        avatar = matchAvatar(name, idNumber);
      }
    }
    res.json({ code: 0, data: { avatar } });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
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
