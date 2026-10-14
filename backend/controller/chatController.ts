import { Request, Response } from 'express';
import { CID_RE, getChat, postChat } from '../service/chatService';

/**
 * GET /api/chat?cid=...&after=12
 * after 이후 메시지와 접속자 수 (after가 없으면 최근 기록 전체)
 */
export const listMessages = (req: Request, res: Response) => {
    const cid = typeof req.query.cid === 'string' && CID_RE.test(req.query.cid) ? req.query.cid : null;
    const after = req.query.after != null ? Number(req.query.after) : null;
    res.json(getChat(cid, after != null && Number.isFinite(after) ? after : null));
};

/**
 * POST /api/chat  { cid, nick, text }
 */
export const sendMessage = (req: Request, res: Response) => {
    const { cid, nick, text } = req.body ?? {};
    const result = postChat(typeof cid === 'string' ? cid : '', nick, text);
    res.status(result.ok ? 200 : result.error === 'rate' || result.error === 'busy' ? 429 : 400).json(result);
};
