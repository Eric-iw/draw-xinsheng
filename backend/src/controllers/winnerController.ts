import { Router, Request, Response } from 'express';
import { winnerService } from '../services/winnerService';

const router = Router();

// GET /api/winners
router.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await winnerService.findAll();
    res.json({ code: 0, data: list });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// GET /api/winners/round/:roundNo
router.get('/round/:roundNo', async (req: Request, res: Response) => {
  try {
    const list = await winnerService.findByRound(Number(req.params.roundNo));
    res.json({ code: 0, data: list });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// GET /api/winners/current-round
router.get('/current-round', async (_req: Request, res: Response) => {
  try {
    const round = await winnerService.getCurrentRound();
    res.json({ code: 0, data: round });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// POST /api/winners/draw — 执行一轮抽奖（排除已中奖，优先拟定中奖人）
router.post('/draw', async (req: Request, res: Response) => {
  try {
    const count = Math.min(50, Math.max(1, Number(req.body.count) || 10));
    const result = await winnerService.draw(count);
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// POST /api/winners — 记录中奖（自动分配轮次）
router.post('/', async (req: Request, res: Response) => {
  try {
    const { participant_id, name, id_number, avatar } = req.body;
    if (!participant_id || !name || !id_number) {
      res.status(400).json({ code: 1, msg: 'participant_id / name / id_number 必填' });
      return;
    }
    const round_no = await winnerService.getCurrentRound();
    const w = await winnerService.recordWinner({
      participant_id,
      name,
      id_number,
      avatar: avatar || '/avatar.png',
      round_no,
    });
    res.json({ code: 0, data: w });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// DELETE /api/winners — 清空中奖记录
router.delete('/', async (_req: Request, res: Response) => {
  try {
    await winnerService.clearAll();
    res.json({ code: 0, msg: '已清空' });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

export default router;
