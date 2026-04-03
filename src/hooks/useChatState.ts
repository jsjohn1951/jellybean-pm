import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../lib/fetcher';
import type { ChatUserState } from '../lib/chat-types';

export function useChatState(userLogin: string) {
  const [openDms, setOpenDms] = useState<string[]>([]);
  const [lastRead, setLastRead] = useState<Record<string, string>>({});

  // Fetch persisted user state on mount
  useEffect(() => {
    apiFetch<ChatUserState>('/api/jellybean/data/chat/user-state')
      .then(state => {
        setOpenDms(state.openDms ?? []);
        setLastRead(state.lastRead ?? {});
      })
      .catch(() => {
        // non-fatal — default empty state is fine
      });
  }, []);

  // Ref that always tracks the latest state to avoid stale closures in callbacks
  const latestStateRef = useRef<{ openDms: string[]; lastRead: Record<string, string> }>({
    openDms: [],
    lastRead: {},
  });

  useEffect(() => {
    latestStateRef.current = { openDms, lastRead };
  }, [openDms, lastRead]);

  // Debounce ref for persisting state back to GitHub
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function scheduleWrite() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await fetch('/api/jellybean/data/chat/user-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(latestStateRef.current),
        });
      } catch {
        // non-fatal
      }
    }, 2000);
  }

  const openDm = useCallback(
    (login: string) => {
      setOpenDms(prev => {
        if (prev.includes(login)) return prev;
        const next = [...prev, login];
        scheduleWrite();
        return next;
      });
    },
    [],
  );

  const closeDm = useCallback(
    (login: string) => {
      setOpenDms(prev => {
        const next = prev.filter(l => l !== login);
        scheduleWrite();
        return next;
      });
    },
    [],
  );

  const markRead = useCallback(
    (convId: string, lastMsgId: string) => {
      setLastRead(prev => {
        const next = { ...prev, [convId]: lastMsgId };
        scheduleWrite();
        return next;
      });
    },
    [],
  );

  // TODO: compute unreadCounts from lastRead vs latest page messages.
  // This requires access to message data from useChat, so it is intentionally
  // left as an empty record here. Callers (e.g. ChatView.tsx) should compute
  // unread counts where both useChat and useChatState results are available.
  const unreadCounts: Record<string, number> = {};

  return {
    openDms,
    lastRead,
    unreadCounts,
    openDm,
    closeDm,
    markRead,
  };
}
