import { Router } from 'express';
import { getHistory } from '../controller/historyController';

const router = Router();

router.get('/history', getHistory);

export default router; 