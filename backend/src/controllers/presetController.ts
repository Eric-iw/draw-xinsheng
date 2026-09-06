import { Router, Request, Response } from 'express';
import { presetService } from '../services/presetService';
import { studentService } from '../services/studentService';

const router = Router();

// GET /api/preset — 拟定中奖人列表
router.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await presetService.findAll();
    res.json({ code: 0, data: list });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// POST /api/preset — 新增拟定中奖人（按学号；学号必须在学生库中）
router.post('/', async (req: Request, res: Response) => {
  try {
    const id_number = String(req.body.id_number || '').trim();
    if (!id_number) {
      res.status(400).json({ code: 1, msg: 'id_number 必填' });
      return;
    }
    const student = await studentService.findByIdNumber(id_number);
    if (!student) {
      res.status(403).json({ code: 1, msg: '学号不存在于学生库' });
      return;
    }
    await presetService.add(id_number);
    res.json({ code: 0, data: { id_number } });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// DELETE /api/preset/:id — 移除一条拟定
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ok = await presetService.remove(Number(req.params.id));
    res.json({ code: 0, data: ok });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// DELETE /api/preset — 清空拟定
router.delete('/', async (_req: Request, res: Response) => {
  try {
    await presetService.clear();
    res.json({ code: 0, msg: '已清空' });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

export default router;
