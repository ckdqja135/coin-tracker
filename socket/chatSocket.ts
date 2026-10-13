import { Namespace, Server as SocketIOServer, Socket } from 'socket.io';
import logger from '../log/logger';

/**
 * 실시간 채팅 (/chat 네임스페이스)
 * - 로그인 없이 닉네임만으로 참여한다. 최근 메시지는 메모리에만 보관한다 (서버 재시작 시 사라짐).
 * - 스팸 방지
 *   · IP별 횟수 제한: 거부된 요청까지 센다 (링크 차단 우회를 무제한으로 시험하지 못하게)
 *   · 연결별 간격 제한: 성공한 전송 사이에만 적용한다 (거부된 메시지를 고쳐 바로 다시 보낼 수 있게)
 *   · 방 전체 상한: 연결을 여러 개 열어도 기록이 순식간에 밀려나지 않게 한다
 *   · 링크 금지 (전각 문자로 쓴 링크도 막는다)
 * - X-Forwarded-For는 TRUST_PROXY로 프록시 수를 지정했을 때만 믿는다 (아니면 누구나 IP를 위조할 수 있다).
 */

export interface ChatMessage { id: string; nick: string; text: string; time: number }

const HISTORY = 50;
const MAX_TEXT = 200;
const MAX_NICK = 16;
const MIN_GAP_MS = 1_500;
const IP_WINDOW_MS = 30_000;
const IP_MAX_IN_WINDOW = 10;
const ROOM_WINDOW_MS = 10_000;
const ROOM_MAX_IN_WINDOW = 30;
// 앞단 프록시 수 (nginx 하나면 1). true는 1로 본다
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' ? 1 : Math.max(0, parseInt(process.env.TRUST_PROXY ?? '0', 10) || 0);

const history: ChatMessage[] = [];
const ipSent = new Map<string, number[]>();
let roomSent: number[] = [];
let seq = 0;

// 제어 문자를 지우고 공백을 정리한다
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s : '')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|kr|xyz|me|ly|gg|co)\b|t\.me\/|discord\.gg)/i;

/** 전각 문자(ｗｗｗ．ｃｏｍ)와 동양식 마침표(。)를 일반 문자로 바꿔 검사한다. 원문은 바꾸지 않는다 */
const hasLink = (s: string) => LINK_RE.test(s.normalize('NFKC').replace(/[。]/g, '.'));

/**
 * 클라이언트 IP. 프록시 뒤라면 X-Forwarded-For의 오른쪽에서 TRUST_PROXY번째 주소를 쓴다
 * (가장 왼쪽 값은 클라이언트가 마음대로 넣을 수 있어 믿지 않는다).
 */
const ipOf = (socket: Socket) => {
    if (TRUST_PROXY > 0) {
        const fwd = socket.handshake.headers['x-forwarded-for'];
        const list = (Array.isArray(fwd) ? fwd.join(',') : fwd ?? '').split(',').map(x => x.trim()).filter(Boolean);
        const ip = list[list.length - TRUST_PROXY];
        if (ip) return ip;
    }
    return socket.handshake.address;
};

/** IP별 횟수 제한 (거부된 요청도 센다) */
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

/** 방 전체 상한 (성공한 전송만 센다) */
const allowRoom = (now: number) => {
    roomSent = roomSent.filter(t => now - t < ROOM_WINDOW_MS);
    if (roomSent.length >= ROOM_MAX_IN_WINDOW) return false;
    roomSent.push(now);
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
            const now = Date.now();
            if (!allowIp(ip, now)) return reply({ ok: false, error: 'rate' });
            if (hasLink(text) || hasLink(nick)) return reply({ ok: false, error: 'link' });
            if (now - lastSent < MIN_GAP_MS) return reply({ ok: false, error: 'rate' });
            if (!allowRoom(now)) return reply({ ok: false, error: 'busy' });
            lastSent = now;

            const msg: ChatMessage = { id: `${now}-${++seq}`, nick, text, time: now };
            history.push(msg);
            if (history.length > HISTORY) history.shift();
            nsp.emit('message', msg);
            reply({ ok: true });
        });

        socket.on('disconnect', () => broadcastOnline(nsp));
    });

    logger.info('[chat] namespace /chat ready');
};
