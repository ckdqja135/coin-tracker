/**
 * 실시간 채팅 (HTTP 폴링 방식)
 * 프론트(Vercel, HTTPS)가 rewrite로 이 서버(HTTP)에 요청을 넘기는 구조라 웹소켓 대신 일반 요청을 쓴다.
 * - 로그인 없이 닉네임만으로 참여한다. 최근 메시지는 메모리에만 보관한다 (서버 재시작 시 사라짐).
 * - 요청이 Vercel을 거쳐 들어와 사용자 IP를 알 수 없으므로, 브라우저가 만든 임시 ID(cid)로 사용자를 구분한다.
 * - 스팸 방지
 *   · ID별 횟수 제한: 거부된 요청까지 센다 (링크 차단 우회를 무제한으로 시험하지 못하게)
 *   · ID별 간격 제한: 성공한 전송 사이에만 적용한다 (거부된 메시지를 고쳐 바로 다시 보낼 수 있게)
 *   · 방 전체 상한: ID를 바꿔 가며 보내도 기록이 순식간에 밀려나지 않게 한다
 *   · 링크 금지 (전각 문자로 쓴 링크도 막는다)
 */

export interface ChatMessage { id: number; nick: string; text: string; time: number }
export type ChatError = 'empty' | 'rate' | 'link' | 'busy' | 'cid';

const HISTORY = 50;
const MAX_TEXT = 200;
const MAX_NICK = 16;
const MIN_GAP_MS = 1_500;
const CID_WINDOW_MS = 30_000;
const CID_MAX_IN_WINDOW = 10;
const ROOM_WINDOW_MS = 10_000;
const ROOM_MAX_IN_WINDOW = 30;
// 이 시간 안에 메시지를 받아 간 ID를 접속 중으로 본다 (화면은 몇 초마다 받아 간다)
const ONLINE_MS = 30_000;

export const CID_RE = /^[a-z0-9]{16,40}$/;

const history: ChatMessage[] = [];
const sent = new Map<string, { times: number[]; last: number }>();
const seen = new Map<string, number>();
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

// 오래된 ID 기록 정리
setInterval(() => {
    const now = Date.now();
    sent.forEach((v, cid) => { if (now - v.last > CID_WINDOW_MS && !v.times.some(t => now - t < CID_WINDOW_MS)) sent.delete(cid); });
    seen.forEach((t, cid) => { if (now - t > ONLINE_MS) seen.delete(cid); });
}, 60_000).unref();

/** after(메시지 번호) 이후 메시지와 접속자 수. after가 없으면 최근 기록 전체 */
export const getChat = (cid: string | null, after: number | null) => {
    const now = Date.now();
    if (cid) seen.set(cid, now);
    let online = 0;
    seen.forEach(t => { if (now - t <= ONLINE_MS) online++; });
    const messages = after == null ? history : history.filter(m => m.id > after);
    return { messages, online, last: seq };
};

export const postChat = (cid: string, rawNick: unknown, rawText: unknown): { ok: true; message: ChatMessage } | { ok: false; error: ChatError } => {
    if (!CID_RE.test(cid)) return { ok: false, error: 'cid' };
    const nick = clean(rawNick, MAX_NICK);
    const text = clean(rawText, MAX_TEXT);
    if (!nick || !text) return { ok: false, error: 'empty' };

    const now = Date.now();
    const rec = sent.get(cid) ?? { times: [], last: 0 };
    rec.times = rec.times.filter(t => now - t < CID_WINDOW_MS);
    if (rec.times.length >= CID_MAX_IN_WINDOW) {
        sent.set(cid, rec);
        return { ok: false, error: 'rate' };
    }
    rec.times.push(now);
    sent.set(cid, rec);

    if (hasLink(text) || hasLink(nick)) return { ok: false, error: 'link' };
    if (now - rec.last < MIN_GAP_MS) return { ok: false, error: 'rate' };
    roomSent = roomSent.filter(t => now - t < ROOM_WINDOW_MS);
    if (roomSent.length >= ROOM_MAX_IN_WINDOW) return { ok: false, error: 'busy' };
    roomSent.push(now);
    rec.last = now;

    const message: ChatMessage = { id: ++seq, nick, text, time: now };
    history.push(message);
    if (history.length > HISTORY) history.shift();
    seen.set(cid, now);
    return { ok: true, message };
};
