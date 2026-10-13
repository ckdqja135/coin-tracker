import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Box, Button, IconButton, InputBase, Paper, Stack, Typography } from '@mui/material';
import { TKey, useI18n } from '../i18n';
import { storage } from '../lib/chartUtils';

interface ChatMessage { id: string; nick: string; text: string; time: number }

const MAX_TEXT = 200;
const MAX_KEEP = 100;
const randomNick = () => `anon${Math.floor(1000 + Math.random() * 9000)}`;

/**
 * 화면 오른쪽 아래 실시간 채팅 (서버 /chat 네임스페이스)
 * 화면과 같은 주소로 붙으므로 HTTPS로 배포하면 소켓도 자동으로 wss로 연결된다.
 * 창을 처음 열 때 연결하고, 닫아도 연결은 유지해 새 메시지 수를 보여준다.
 */
const ChatWidget: React.FC = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [nick, setNick] = useState(() => storage.get('chatNick', randomNick()));
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => storage.set('chatNick', nick), [nick]);

  useEffect(() => {
    if (!started) return;
    const s = io('/chat');
    socketRef.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('history', (h: ChatMessage[]) => setMessages(h));
    s.on('online', (n: number) => setOnline(n));
    s.on('message', (m: ChatMessage) => {
      setMessages(list => [...list, m].slice(-MAX_KEEP));
      if (!openRef.current) setUnread(n => n + 1);
    });
    return () => { s.disconnect(); socketRef.current = null; };
  }, [started]);

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const toggle = () => {
    setOpen(o => !o);
    setStarted(true);
    setUnread(0);
  };

  const send = () => {
    const body = text.trim();
    if (!body || !socketRef.current) return;
    socketRef.current.emit('message', { nick: nick.trim() || randomNick(), text: body }, (res: { ok: boolean; error?: string }) => {
      if (res?.ok) { setText(''); setError(null); } else setError(`chat.err.${res?.error ?? 'empty'}`);
    });
  };

  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <>
      {open && (
        <Paper elevation={8} sx={{
          position: 'fixed', right: { xs: 8, sm: 16 }, bottom: 72, zIndex: 1250, width: { xs: 'calc(100vw - 16px)', sm: 340 }, height: 440,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 2,
        }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{t('chat.title')}</Typography>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: connected ? '#26a69a' : 'text.disabled' }} />
            {online != null && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('chat.online', { n: String(online) })}</Typography>}
            <Box sx={{ flexGrow: 1 }} />
            <IconButton size="small" onClick={() => setOpen(false)} aria-label={t('chat.close')}>✕</IconButton>
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

      <Button onClick={toggle} variant="contained"
        sx={{ position: 'fixed', right: { xs: 8, sm: 16 }, bottom: 16, zIndex: 1250, borderRadius: 99, px: 2, fontWeight: 800, boxShadow: 4 }}>
        💬 {t('chat.title')}
        {unread > 0 && (
          <Box component="span" sx={{ ml: 1, bgcolor: '#ef5350', color: '#fff', borderRadius: 99, px: 0.8, fontSize: 11, lineHeight: '18px' }}>{unread > 99 ? '99+' : unread}</Box>
        )}
      </Button>
    </>
  );
};

export default ChatWidget;
