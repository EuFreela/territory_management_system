import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { IconNote, IconSend, IconSmile, IconX } from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getChatClientId } from '@/lib/chat-session';
import { cn } from '@/lib/utils';

type OnlineUser = {
  userId: number;
  name: string;
  updatedAt: number;
  /** Abas/clientes ativos desta conta */
  sessions?: number;
};

type ChatMessage = {
  id: number;
  user_id: number;
  user_name: string;
  body: string;
  created_at: string;
  kind?: 'user' | 'system';
};

type ChatState = {
  online: OnlineUser[];
  messages: ChatMessage[];
};

const HEARTBEAT_MS = 15_000;
const POLL_OPEN_MS = 2_500;
const POLL_CLOSED_MS = 8_000;
const MAX_BODY = 500;

/** Emoticons rápidos do chat (sem lib externa) */
const CHAT_EMOJIS = [
  '😀',
  '😁',
  '😂',
  '😊',
  '😍',
  '😎',
  '🤔',
  '😅',
  '😢',
  '😡',
  '👍',
  '👎',
  '👏',
  '🙏',
  '💪',
  '❤️',
  '🔥',
  '⭐',
  '✅',
  '❌',
  '🎉',
  '🙌',
  '👋',
  '🤝',
  '📍',
  '🗺️',
  '🏠',
  '⏰',
  '☕',
  '🚗',
] as const;

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export default function FloatingChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);

  const lastIdRef = useRef(0);
  const seededRef = useRef(false);
  const openRef = useRef(open);
  const bottomRef = useRef<HTMLDivElement>(null);

  openRef.current = open;

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) {
      seededRef.current = true;
      return;
    }
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return prev;
      const next = [...prev, ...fresh].sort((a, b) => a.id - b.id);
      // Mantém as últimas ~120 em memória no cliente
      return next.length > 120 ? next.slice(next.length - 120) : next;
    });
    const maxId = Math.max(...incoming.map((m) => m.id));
    if (maxId > lastIdRef.current) {
      // Primeiro carregamento: só ancora o cursor, sem badge de não lidas
      if (seededRef.current && !openRef.current) {
        const newOnes = incoming.filter((m) => {
          if (m.id <= lastIdRef.current) return false;
          // Avisos de sistema (saiu) e mensagens de outros contam como não lidas
          if (m.kind === 'system') return true;
          return m.user_id !== user?.id;
        });
        if (newOnes.length > 0) setUnread((u) => u + newOnes.length);
      }
      lastIdRef.current = maxId;
    }
    seededRef.current = true;
  }, [user?.id]);

  const pollState = useCallback(async () => {
    try {
      const after = lastIdRef.current;
      const data = await api<ChatState>(`/api/chat/state?after=${after}`);
      setOnline(data.online ?? []);
      mergeMessages(data.messages ?? []);
      setError('');
    } catch {
      // silencioso no poll — evita spam se a sessão cair
    }
  }, [mergeMessages]);

  // Heartbeat de sessão (online).
  // Não faz DELETE no cleanup do React (Strict Mode / remount) — isso gerava
  // vários "entrou/saiu". Saída real: pagehide, logout ou expiração no servidor.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const clientId = getChatClientId();

    async function beat() {
      try {
        await api('/api/presence/session', {
          method: 'PUT',
          body: JSON.stringify({ clientId }),
        });
      } catch {
        /* ignore */
      }
    }

    void beat();
    const id = window.setInterval(() => {
      if (!cancelled) void beat();
    }, HEARTBEAT_MS);

    function onUnload() {
      void fetch(`/api/presence/session?clientId=${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
        credentials: 'include',
        keepalive: true,
      });
    }
    window.addEventListener('pagehide', onUnload);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [user?.id]);

  // Poll de mensagens / online
  useEffect(() => {
    if (!user) return;
    void pollState();
    const ms = open ? POLL_OPEN_MS : POLL_CLOSED_MS;
    const id = window.setInterval(() => void pollState(), ms);
    return () => window.clearInterval(id);
  }, [user, open, pollState]);

  // Ao abrir: limpa não lidas; ao recolher: fecha o painel de emojis
  useEffect(() => {
    if (!open) {
      setEmojiOpen(false);
      return;
    }
    setUnread(0);
  }, [open]);

  function insertEmoji(emoji: string) {
    setDraft((prev) => {
      if (prev.length >= MAX_BODY) return prev;
      const next = prev + emoji;
      return next.length > MAX_BODY ? next.slice(0, MAX_BODY) : next;
    });
  }

  // Auto-scroll ao receber mensagens com o painel aberto
  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function onSend(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    if (body.length > MAX_BODY) {
      setError(`Máximo de ${MAX_BODY} caracteres.`);
      return;
    }

    setSending(true);
    setError('');
    try {
      const res = await api<{ message: ChatMessage }>('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setDraft('');
      if (res.message) mergeMessages([res.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar.');
    } finally {
      setSending(false);
    }
  }

  if (!user) return null;

  const othersOnline = online.filter((u) => u.userId !== user.id);
  const onlineCount = online.length;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {open ? (
        <div
          className="pointer-events-auto flex w-[min(22.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-float"
          role="dialog"
          aria-label="Chat do campo"
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-foreground">Chat</p>
              <p className="text-[11px] text-muted-foreground">
                {onlineCount === 0
                  ? 'Ninguém online'
                  : onlineCount === 1
                    ? '1 online'
                    : `${onlineCount} online`}
                {' · '}
                mensagens para todos
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label="Recolher chat"
              data-tooltip="Recolher"
            >
              <IconX className="size-4" />
            </Button>
          </div>

          {/* Online */}
          <div className="border-b border-border px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Online agora
            </p>
            {online.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aguardando usuários…</p>
            ) : (
              <ul className="flex max-h-[4.5rem] flex-wrap gap-1.5 overflow-y-auto">
                {online.map((u) => {
                  const isMe = u.userId === user.id;
                  const sessions = Math.max(1, Number(u.sessions) || 1);
                  const label = `${u.name}${isMe ? ' (você)' : ''}${
                    sessions > 1 ? `[${sessions}]` : ''
                  }`;
                  return (
                    <li
                      key={u.userId}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        isMe
                          ? 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200'
                          : 'border-border bg-muted/60 text-foreground',
                      )}
                      title={
                        sessions > 1
                          ? `${u.name}: ${sessions} abas/dispositivos online`
                          : u.name
                      }
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                        aria-hidden
                      />
                      <span className="max-w-[10rem] truncate">{label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {othersOnline.length === 0 && onlineCount > 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Só você está online no momento.
              </p>
            ) : null}
          </div>

          {/* Mensagens */}
          <div className="flex h-[min(16rem,40vh)] flex-col gap-2 overflow-y-auto px-3 py-2.5">
            {messages.length === 0 ? (
              <p className="m-auto max-w-[14rem] text-center text-xs leading-relaxed text-muted-foreground">
                Nenhuma mensagem ainda. Escreva para quem estiver online.
              </p>
            ) : (
              messages.map((m) => {
                if (m.kind === 'system') {
                  return (
                    <div
                      key={m.id}
                      className="flex justify-center px-2 py-0.5"
                      role="status"
                    >
                      <p className="max-w-[95%] rounded-full bg-muted/70 px-2.5 py-0.5 text-center text-[11px] font-medium text-muted-foreground">
                        {m.body}
                        {m.created_at ? (
                          <span className="font-normal opacity-70">
                            {' · '}
                            {formatTime(m.created_at)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  );
                }

                const mine = m.user_id === user.id;
                return (
                  <div
                    key={m.id}
                    className={cn('flex flex-col gap-0.5', mine ? 'items-end' : 'items-start')}
                  >
                    <div className="flex items-center gap-1.5 px-0.5">
                      {!mine ? (
                        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                          {initials(m.user_name)}
                        </span>
                      ) : null}
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {mine ? 'Você' : m.user_name}
                        {m.created_at ? ` · ${formatTime(m.created_at)}` : ''}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug',
                        mine
                          ? 'rounded-br-md bg-sky-600 text-white'
                          : 'rounded-bl-md bg-muted text-foreground',
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Emoticons */}
          {emojiOpen ? (
            <div
              className="border-t border-border bg-muted/30 px-2 py-2"
              role="listbox"
              aria-label="Emoticons"
            >
              <div className="grid max-h-28 grid-cols-8 gap-0.5 overflow-y-auto">
                {CHAT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    role="option"
                    onClick={() => insertEmoji(emoji)}
                    disabled={sending || draft.length >= MAX_BODY}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-md text-base transition',
                      'hover:bg-muted active:scale-95',
                      'disabled:pointer-events-none disabled:opacity-40',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    )}
                    aria-label={`Inserir ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Composer */}
          <form
            onSubmit={(e) => void onSend(e)}
            className="flex items-center gap-1.5 border-t border-border p-2.5"
          >
            <Button
              type="button"
              variant={emojiOpen ? 'secondary' : 'ghost'}
              size="icon"
              className="shrink-0"
              onClick={() => setEmojiOpen((v) => !v)}
              aria-label={emojiOpen ? 'Fechar emoticons' : 'Emoticons'}
              aria-pressed={emojiOpen}
              data-tooltip="Emoticons"
              disabled={sending}
            >
              <IconSmile className="size-4" />
            </Button>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Mensagem para todos…"
              maxLength={MAX_BODY}
              disabled={sending}
              className="h-9 flex-1"
              autoComplete="off"
              autoFocus
              aria-label="Mensagem do chat"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !draft.trim()}
              className="shrink-0"
              aria-label="Enviar"
              data-tooltip="Enviar"
            >
              <IconSend className="size-4" />
            </Button>
          </form>
          {error ? (
            <p className="px-3 pb-2 text-[11px] text-destructive">{error}</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'pointer-events-auto relative flex size-12 items-center justify-center rounded-full shadow-float transition',
          'bg-sky-600 text-white hover:bg-sky-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
          'active:scale-[0.97]',
        )}
        aria-label={open ? 'Recolher chat' : 'Abrir chat'}
        aria-expanded={open}
        data-tooltip={open ? 'Recolher chat' : 'Chat'}
        data-tooltip-side="left"
      >
        {open ? <IconX className="size-5" /> : <IconNote className="size-5" />}
        {!open && unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
        {!open && onlineCount > 1 ? (
          <span
            className="absolute bottom-0.5 right-0.5 size-2.5 rounded-full border-2 border-sky-600 bg-emerald-400"
            aria-hidden
          />
        ) : null}
      </button>
    </div>
  );
}
