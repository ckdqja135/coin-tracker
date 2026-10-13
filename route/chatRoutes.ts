import { Router } from 'express';
import { listMessages, sendMessage } from '../controller/chatController';

const router = Router();

// 실시간 채팅 (HTTP 폴링)
router.get('/', listMessages);
router.post('/', sendMessage);

export default router;
