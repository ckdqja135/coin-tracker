import { Router } from 'express';
import coinRoutes from './coinRoutes';
import marketRoutes from './marketRoutes';

const router = Router();

// 코인 관련 라우트들을 /coin 경로로 연결
router.use('/coin', coinRoutes);

// 외부 거래소 시장 데이터 라우트들을 /market 경로로 연결 (DB 불필요)
router.use('/market', marketRoutes);

// 향후 다른 라우터들 추가 가능
// router.use('/user', userRoutes);
// router.use('/admin', adminRoutes);

export default router; 