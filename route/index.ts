import { Router } from 'express';
import coinRoutes from './coinRoutes';
import marketRoutes from './marketRoutes';
import chatRoutes from './chatRoutes';

const router = Router();

// 코인 관련 라우트들을 /coin 경로로 연결
router.use('/coin', coinRoutes);

// 외부 거래소 시장 데이터 라우트들을 /market 경로로 연결 (DB 불필요)
router.use('/market', marketRoutes);

// 실시간 채팅 (HTTP 폴링, DB 불필요)
router.use('/chat', chatRoutes);

// 향후 다른 라우터들 추가 가능
// router.use('/user', userRoutes);
// router.use('/admin', adminRoutes);

export default router; 