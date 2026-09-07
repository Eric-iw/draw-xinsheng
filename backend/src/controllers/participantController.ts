import { Router, Request, Response } from 'express';
import { participantService } from '../services/participantService';
import { studentService } from '../services/studentService';
import { matchAvatarOrDefault } from '../utils/avatar';

const router = Router();

// GET /api/participants — 获取全部参与者
router.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await participantService.findAll();
    res.json({ code: 0, data: list });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// GET /api/participants/count
router.get('/count', async (_req: Request, res: Response) => {
  try {
    const cnt = await participantService.count();
    res.json({ code: 0, data: cnt });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// POST /api/participants — 注册（校验：学号必须在学生库且姓名匹配）
router.post('/', async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    const id_number = String(req.body.id_number || '').trim();
    if (!name || !id_number) {
      res.status(400).json({ code: 1, msg: '姓名和学号必填' });
      return;
    }
    // 学生库白名单校验：学号必须存在，且姓名与学号绑定一致（防乱填/重名顶替）
    const student = await studentService.findByIdNumber(id_number);
    if (!student) {
      res.status(403).json({ code: 1, msg: '学号不存在于学生库，无法注册，请联系管理员' });
      return;
    }
    if (student.name !== name) {
      res.status(403).json({ code: 1, msg: '姓名和学号不匹配，请检查后重新填写' });
      return;
    }
    const p = await participantService.create({
      name,
      id_number,
      avatar: matchAvatarOrDefault(name, id_number),
    });
    res.json({ code: 0, data: p });
  } catch (err) {
    // 学号唯一约束冲突（ER_DUP_ENTRY）
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      res.status(409).json({ code: 1, msg: '该学号已注册，请勿重复提交' });
      return;
    }
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// POST /api/participants/bulk — 批量新增
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const list = req.body as { name: string; id_number: string; avatar?: string | null }[];
    if (!Array.isArray(list)) {
      res.status(400).json({ code: 1, msg: 'body 必须是数组' });
      return;
    }
    // avatar 置 null 时回填默认值，避免 undefined
    const normalized = list.map((i) => ({ ...i, avatar: (i.avatar ?? '/avatar.png') as string }));
    const affected = await participantService.bulkCreate(normalized);
    res.json({ code: 0, data: { affected } });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// DELETE /api/participants — 清空全部已录入信息
router.delete('/', async (_req: Request, res: Response) => {
  try {
    const affected = await participantService.clearAll();
    res.json({ code: 0, data: { affected } });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// DELETE /api/participants/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ok = await participantService.remove(Number(req.params.id));
    res.json({ code: ok ? 0 : 1, data: ok });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

export default router;
