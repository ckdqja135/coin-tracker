import axios from 'axios';

// 다른 API와 같은 경로(/api)로 요청한다. Vercel에서는 rewrite로 백엔드에 전달된다.
const client = axios.create({ baseURL: '/api/chat', timeout: 10000 });

export interface ChatMessage { id: number; nick: string; text: string; time: number }
export interface ChatSnapshot { messages: ChatMessage[]; online: number; last: number }

export const fetchChat = async (cid: string, after: number | null): Promise<ChatSnapshot> =>
  (await client.get('', { params: { cid, ...(after != null ? { after } : {}) } })).data;

/** 성공하면 null, 실패하면 서버가 준 오류 코드 */
export const postChat = async (cid: string, nick: string, text: string): Promise<string | null> => {
  try {
    await client.post('', { cid, nick, text });
    return null;
  } catch (e: any) {
    return e?.response?.data?.error ?? 'network';
  }
};
