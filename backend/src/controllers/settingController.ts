import { Router, Request, Response } from 'express';
import { settingService } from '../services/settingService';

const router = Router();

// GET /api/settings — 获取系统配置（首页和后台共用）
router.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await settingService.getConfig();
    res.json({ code: 0, data: config });
  } catch (err) {
    res.status(500).json({ code: 1, msg: (err as Error).message });
  }
});

// PUT /api/settings/max-rounds — 修改抽奖总轮次
router.put('/max-rounds', async (req: Request, res: Response) => {
  try {
    const value = Number(req.body?.maxRounds);
    const maxRounds = await settingService.setMaxRounds(value);
    res.json({ code: 0, data: { maxRounds } });
  } catch (err) {
    const msg = (err as Error).message;
    // 业务参数错误
    if (msg.includes('轮次必须')) {
      res.status(400).json({ code: 1, msg });
      return;
    }
    res.status(500).json({ code: 1, msg: '服务未开启，请稍后再试' });
  }
});

export default router;
