import { Router } from 'express';
import participantRoutes from '../controllers/participantController';
import winnerRoutes from '../controllers/winnerController';
import studentRoutes from '../controllers/studentController';
import presetRoutes from '../controllers/presetController';
import settingRoutes from '../controllers/settingController';

const router = Router();

router.use('/participants', participantRoutes);
router.use('/winners', winnerRoutes);
router.use('/students', studentRoutes);
router.use('/preset', presetRoutes);
router.use('/settings', settingRoutes);

export default router;
