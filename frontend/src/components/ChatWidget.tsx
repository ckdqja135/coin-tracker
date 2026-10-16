import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, InputBase, Paper, Stack, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TKey, useI18n } from '../i18n';
import { storage } from '../lib/chartUtils';
import { fabSx, panelSx, useFloating } from '../lib/floating';
import { ChatMessage, fetchChat, postChat } from '../services/chat';

const MAX_TEXT = 200;
const MAX_KEEP = 100;
// 창이 열려 있을 때 / 닫혀 있을 때(새 메시지 수만 셈) 새 메시지를 받아 오는 간격
const POLL_OPEN_MS = 2_500;
const POLL_CLOSED_MS = 15_000;
// 채팅 창 크기 (왼쪽 위 모서리·왼쪽·위쪽 가장자리를 끌어 조절, 브라우저에 기억)
const DEFAULT_SIZE = { w: 400, h: 440 };
const MIN_SIZE = { w: 300, h: 300 };
const MAX_W = 800;
type Size = { w: number; h: number };
type Edge = 'corner' | 'left' | 'top';
const clampSize = ({ w, h }: Size): Size => ({
  // 창은 오른쪽 아래에 붙어 있으므로 화면 왼쪽·위쪽 여백 안에서만 커진다
  w: Math.round(Math.min(Math.max(w, MIN_SIZE.w), MAX_W, window.innerWidth - 56)),
  h: Math.round(Math.min(Math.max(h, MIN_SIZE.h), window.innerHeight - 120)),
});
const randomNick = () => `anon${Math.floor(1000 + Math.random() * 9000)}`;
const randomId = () => Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

/**
 * 화면 오른쪽 아래 실시간 채팅 (서버 /api/chat, HTTP 폴링)
 * 프론트(HTTPS)와 백엔드(HTTP)가 따로 배포되어 웹소켓 대신 다른 API처럼 일반 요청으로 주고받는다.
 * 창을 처음 열 때부터 받아 오고, 닫아도 느린 간격으로 받아 새 메시지 수를 보여준다.
 */
const ChatWidget: React.FC = () => {
  const { t } = useI18n();
  const { panel, setPanel, toggle: togglePanel } = useFloating();
  const open = panel === 'chat';
  const [started, setStarted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [nick, setNick] = useState(() => storage.get('chatNick', randomNick()));
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  // 이 브라우저의 임시 ID (서버가 전송 횟수 제한·접속자 수에 쓴다)
  const [cid] = useState(() => {
    const saved = storage.get<string>('chatCid', '');
    if (/^[a-z0-9]{16,40}$/.test(saved)) return saved;
    const id = randomId();
    storage.set('chatCid', id);
    return id;
  });
  const lastId = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => storage.set('chatNick', nick), [nick]);

  // 새 메시지 받아 오기 (처음에는 최근 기록 전체, 이후에는 마지막 번호 이후만)
  const poll = useCallback(async () => {
    try {
      const after = lastId.current;
      const res = await fetchChat(cid, after);
      // 서버가 재시작해 번호가 처음부터 다시 시작했으면 전체를 다시 받는다
      const reset = after != null && res.last < after;
      const snap = reset ? await fetchChat(cid, null) : res;
      setConnected(true);
      setOnline(snap.online);
      if (after == null || reset) {
        setMessages(snap.messages);
      } else if (snap.messages.length) {
        setMessages(list => [...list, ...snap.messages.filter(m => !list.some(x => x.id === m.id))].slice(-MAX_KEEP));
        if (!openRef.current) setUnread(n => n + snap.messages.length);
      }
      lastId.current = snap.last;
    } catch {
      setConnected(false);
    }
  }, [cid]);

  useEffect(() => {
    if (!started) return;
    poll();
    const id = setInterval(poll, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => clearInterval(id);
  }, [started, open, poll]);

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const toggle = () => {
    togglePanel('chat');
    setStarted(true);
    setUnread(0);
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const err = await postChat(cid, nick.trim() || randomNick(), body);
    if (err) { setError(`chat.err.${err}`); return; }
    setText('');
    setError(null);
    poll();
  };

  // 크기 조절: 휴대폰 폭에서는 화면 폭을 꽉 채우므로 끄고, 그 외에는 끌어서 바꾼다
  const theme = useTheme();
  const resizable = useMediaQuery(theme.breakpoints.up('sm'));
  const [size, setSize] = useState<Size>(() => storage.get('chatSize', DEFAULT_SIZE));
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const startResize = (edge: Edge) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, ...sizeRef.current };
    // 화면 갱신 전에 손을 떼도 마지막 크기를 저장하도록 따로 들고 있는다
    let latest = sizeRef.current;
    const move = (ev: PointerEvent) => {
      latest = clampSize({
        w: edge === 'top' ? start.w : start.w + (start.x - ev.clientX),
        h: edge === 'left' ? start.h : start.h + (start.y - ev.clientY),
      });
      setSize(latest);
    };
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      storage.set('chatSize', latest);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };
  // 모서리를 두 번 누르면 기본 크기로
  const resetSize = () => { setSize(DEFAULT_SIZE); storage.set('chatSize', DEFAULT_SIZE); };
  const handleSx = (edge: Edge) => ({
    position: 'absolute', zIndex: 2, touchAction: 'none',
    ...(edge === 'corner' ? { left: 0, top: 0, width: 18, height: 18, cursor: 'nwse-resize' }
      : edge === 'left' ? { left: 0, top: 18, bottom: 0, width: 6, cursor: 'ew-resize' }
        : { top: 0, left: 18, right: 0, height: 6, cursor: 'ns-resize' }),
  } as const);

  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <>
      {open && (
        <Paper elevation={0} sx={{
          ...panelSx,
          ...(resizable
            ? { width: size.w, height: size.h, maxWidth: 'calc(100vw - 56px)' }
            : { height: 440 }),
        }}>
          {resizable && (
            <>
              <Box onPointerDown={startResize('top')} sx={handleSx('top')} />
              <Box onPointerDown={startResize('left')} sx={handleSx('left')} />
              <Box onPointerDown={startResize('corner')} onDoubleClick={resetSize} title={t('chat.resize')} sx={{
                ...handleSx('corner'),
                // 모서리 표시: 대각선 두 줄
                '&::before': {
                  content: '""', position: 'absolute', left: 4, top: 4, width: 8, height: 8,
                  borderLeft: 2, borderTop: 2, borderColor: 'text.disabled', borderTopLeftRadius: 4, opacity: 0.7,
                },
                '&:hover::before': { borderColor: 'primary.main', opacity: 1 },
              }} />
            </>
          )}
          <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{t('chat.title')}</Typography>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: connected ? '#26a69a' : 'text.disabled' }} />
            {online != null && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('chat.online', { n: String(online) })}</Typography>}
            <Box sx={{ flexGrow: 1 }} />
            <IconButton size="small" onClick={() => setPanel(null)} aria-label={t('chat.close')}>✕</IconButton>
          </Stack>

          <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
            {messages.length === 0 && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', mt: 4 }}>{connected ? t('chat.empty') : t('chat.connecting')}</Typography>
            )}
            {messages.map(m => (
              <Box key={m.id} sx={{ py: 0.4, fontSize: 13, wordBreak: 'break-word' }}>
                <Box component="span" sx={{ fontWeight: 700, color: m.nick === nick ? 'primary.main' : 'text.primary', mr: 0.8 }}>{m.nick}</Box>
                <Box component="span">{m.text}</Box>
                <Box component="span" sx={{ fontSize: 10, color: 'text.secondary', ml: 0.8 }}>{time(m.time)}</Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ borderTop: 1, borderColor: 'divider', p: 1 }}>
            <Stack direction="row" alignItems="center" gap={0.8} sx={{ mb: 0.6 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('chat.nick')}</Typography>
              <InputBase value={nick} onChange={e => setNick(e.target.value.slice(0, 16))}
                sx={{ fontSize: 12, fontWeight: 700, flex: 1, px: 0.8, borderRadius: 1, bgcolor: 'ui.pill.bg' }} />
            </Stack>
            <Stack direction="row" gap={0.8}>
              <InputBase value={text} onChange={e => setText(e.target.value.slice(0, MAX_TEXT))} placeholder={t('chat.placeholder')}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                sx={{ flex: 1, fontSize: 13, px: 1, py: 0.4, borderRadius: 1, bgcolor: 'ui.pill.bg' }} />
              <Button variant="contained" size="small" onClick={send} disabled={!connected || !text.trim()} sx={{ minWidth: 0, fontWeight: 700 }}>{t('chat.send')}</Button>
            </Stack>
            {error && <Typography sx={{ fontSize: 11, color: '#ef5350', mt: 0.5 }}>{t(error as TKey)}</Typography>}
            <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5 }}>{t('chat.rules')}</Typography>
          </Box>
        </Paper>
      )}

      <Button onClick={toggle} variant="contained" sx={{ ...fabSx, boxShadow: '0 6px 18px rgba(47,126,247,.35)' }}>
        {t('chat.title')}
        {unread > 0 && (
          <Box component="span" sx={{ bgcolor: '#ef5350', color: '#fff', borderRadius: 99, px: 0.8, fontSize: 11, lineHeight: '18px' }}>{unread > 99 ? '99+' : unread}</Box>
        )}
      </Button>
    </>
  );
};

export default ChatWidget;
