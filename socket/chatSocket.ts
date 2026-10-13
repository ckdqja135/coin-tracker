import { Namespace, Server as SocketIOServer, Socket } from 'socket.io';
import logger from '../log/logger';
import { hasProfanity, maskProfanity } from './profanity';

/**
 * 실시간 채팅 (/chat 네임스페이스)
 * - 로그인 없이 닉네임만으로 참여한다. 최근 메시지는 메모리에만 보관한다 (서버 재시작 시 사라짐).
 * - 스팸 방지: 메시지 길이 제한, 연결별·IP별 전송 간격/횟수 제한, 링크 금지.
 * - 욕설: 메시지의 욕설은 *로 가리고, 욕설이 든 닉네임은 거부한다.
 */

export interface ChatMessage { id: string; nick: string; text: string; time: number }

const HISTORY = 50;
const MAX_TEXT = 200;
const MAX_NICK = 16;
const MIN_GAP_MS = 1_500;
const IP_WINDOW_MS = 30_000;
const IP_MAX_IN_WINDOW = 10;

const history: ChatMessage[] = [];
const ipSent = new Map<string, number[]>();
let seq = 0;

// 제어 문자를 지우고 공백을 정리한다
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s : '')
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|kr|xyz|me|ly|gg|co)\b|t\.me\/|discord\.gg)/i;

/** 프록시 뒤에서는 X-Forwarded-For의 첫 주소를 쓴다 */
const ipOf = (socket: Socket) => {
    const fwd = socket.handshake.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    return first || socket.handshake.address;
};

const allowIp = (ip: string, now: number) => {
    const list = (ipSent.get(ip) ?? []).filter(t => now - t < IP_WINDOW_MS);
    if (list.length >= IP_MAX_IN_WINDOW) {
        ipSent.set(ip, list);
        return false;
    }
    list.push(now);
    ipSent.set(ip, list);
    return true;
};

// 오래된 IP 기록 정리
setInterval(() => {
    const now = Date.now();
    ipSent.forEach((list, ip) => { if (!list.some(t => now - t < IP_WINDOW_MS)) ipSent.delete(ip); });
}, 60_000).unref();

const broadcastOnline = (nsp: Namespace) => nsp.emit('online', nsp.sockets.size);

export const chatSocket = (io: SocketIOServer): void => {
    const nsp = io.of('/chat');

    nsp.on('connection', socket => {
        const ip = ipOf(socket);
        let lastSent = 0;
        socket.emit('history', history);
        broadcastOnline(nsp);

        socket.on('message', (payload: { nick?: unknown; text?: unknown }, ack?: (res: { ok: boolean; error?: string }) => void) => {
            const reply = typeof ack === 'function' ? ack : () => {};
            const nick = clean(payload?.nick, MAX_NICK);
            const text = clean(payload?.text, MAX_TEXT);
            if (!nick || !text) return reply({ ok: false, error: 'empty' });
            if (LINK_RE.test(text) || LINK_RE.test(nick)) return reply({ ok: false, error: 'link' });
            if (hasProfanity(nick)) return reply({ ok: false, error: 'nick' });
            const now = Date.now();
            if (now - lastSent < MIN_GAP_MS || !allowIp(ip, now)) return reply({ ok: false, error: 'rate' });
            lastSent = now;

            const msg: ChatMessage = { id: `${now}-${++seq}`, nick, text: maskProfanity(text).text, time: now };
            history.push(msg);
            if (history.length > HISTORY) history.shift();
            nsp.emit('message', msg);
            reply({ ok: true });
        });

        socket.on('disconnect', () => broadcastOnline(nsp));
    });

    logger.info('[chat] namespace /chat ready');
};
