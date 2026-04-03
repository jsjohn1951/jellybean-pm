import { useCallback, useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { apiFetch } from '../lib/fetcher';
import type { ChatMessage, ChatAttachment, ChatMeta, ChatPage, ChatTarget } from '../lib/chat-types';
import { dmConvId } from '../lib/chat-types';

export function useChat(target: ChatTarget, userLogin: string, projectSlug?: string) {
  const convKey =
    target === 'group'
      ? (projectSlug ? `project:${projectSlug}` : 'group')
      : dmConvId(userLogin, (target as { dm: string }).dm);
  const apiPrefix =
    target === 'group'
      ? (projectSlug ? `projects/${projectSlug}/chat/group` : 'chat/group')
      : `chat/dm/${convKey}`;

  // Poll meta every 5s to detect new pages
  const { data: meta } = useSWR<ChatMeta>(
    '/api/jellybean/data/chat/meta',
    apiFetch<ChatMeta>,
    { refreshInterval: 5000, dedupingInterval: 4000, revalidateOnFocus: false },
  );

  const latestPageIndex =
    target === 'group'
      ? projectSlug
        ? Math.max(0, (meta?.projects?.[projectSlug]?.group.pageCount ?? 1) - 1)
        : Math.max(0, (meta?.group.pageCount ?? 1) - 1)
      : Math.max(0, (meta?.dms[convKey]?.pageCount ?? 1) - 1);

  const [oldestLoadedPage, setOldestLoadedPage] = useState<number | null>(null);
  const [olderPages, setOlderPages] = useState<ChatPage[]>([]);

  // Reset when conversation changes
  useEffect(() => {
    setOldestLoadedPage(null);
    setOlderPages([]);
  }, [convKey]);

  useEffect(() => {
    if (oldestLoadedPage === null && meta !== undefined) {
      setOldestLoadedPage(latestPageIndex);
    }
  }, [meta, latestPageIndex, oldestLoadedPage]);

  const latestKey =
    latestPageIndex >= 0
      ? `/api/jellybean/data/${apiPrefix}/messages?page=${latestPageIndex}`
      : null;

  const {
    data: latestPageData,
    isLoading: latestLoading,
  } = useSWR<ChatPage>(latestKey, apiFetch<ChatPage>, {
    refreshInterval: 5000,
    dedupingInterval: 4000,
    revalidateOnFocus: false,
  });

  // Optimistic messages: shown immediately, removed once the server poll confirms them
  const [optimisticMessages, setOptimisticMessages] = useState<(ChatMessage & { _pending: true })[]>([]);

  // Locally deleted message IDs — removed optimistically before the server confirms
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const loadOlderPage = useCallback(async () => {
    if (oldestLoadedPage === null || oldestLoadedPage <= 0) return;
    const prevPage = oldestLoadedPage - 1;
    try {
      const data = await apiFetch<ChatPage>(
        `/api/jellybean/data/${apiPrefix}/messages?page=${prevPage}`,
      );
      setOlderPages(prev => [data, ...prev]);
      setOldestLoadedPage(prevPage);
    } catch {
      // non-fatal
    }
  }, [oldestLoadedPage, apiPrefix]);

  // Remove confirmed messages from optimisticMessages once server data includes them.
  // This is the eviction gate — keeps the message visible through stale polls.
  useEffect(() => {
    if (!latestPageData?.messages?.length) return;
    const serverIds = new Set(latestPageData.messages.map(m => m.id));
    setOptimisticMessages(prev => {
      const next = prev.filter(m => !serverIds.has(m.id));
      return next.length === prev.length ? prev : next;
    });
  }, [latestPageData]);

  const sendMessage = useCallback(
    (text: string, attachments: ChatAttachment[]) => {
      // 1. Show message instantly with a pending ID
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatMessage & { _pending: true } = {
        id: tempId,
        authorLogin: userLogin,
        text,
        attachments,
        createdAt: new Date().toISOString(),
        _pending: true,
      };
      setOptimisticMessages(prev => [...prev, optimistic]);

      // 2. POST in background — do not block the caller
      fetch(`/api/jellybean/data/${apiPrefix}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, attachments }),
      })
        .then(async res => {
          if (!res.ok) throw new Error(`send failed: ${res.status}`);
          const confirmed = await res.json() as ChatMessage;
          // 3. Swap pending-xxx → msg-xxx in local state.
          //    The message stays visible here until the server poll includes msg-xxx,
          //    guarding against GitHub CDN staleness after a force-push (amend mode).
          //    isPending styling is driven by id.startsWith('pending-'), so this also
          //    drops the "sending…" indicator automatically.
          setOptimisticMessages(prev =>
            prev.map(m => m.id === tempId ? { ...confirmed, _pending: true as const } : m)
          );
        })
        .catch(() => {
          // 4. On failure remove the entry — message couldn't be sent
          setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
        });
    },
    [apiPrefix, userLogin],
  );

  const deleteMessage = useCallback(
    async (msgId: string) => {
      // Remove from UI immediately
      setDeletedIds(prev => new Set(prev).add(msgId));
      const convSegment = target === 'group' ? 'group' : `dm/${apiPrefix.slice('chat/dm/'.length)}`;
      try {
        const res = await fetch(`/api/jellybean/data/chat/${convSegment}/messages/${msgId}`, { method: 'DELETE' });
        if (!res.ok) {
          // Restore if server rejected
          setDeletedIds(prev => { const next = new Set(prev); next.delete(msgId); return next; });
        }
      } catch {
        setDeletedIds(prev => { const next = new Set(prev); next.delete(msgId); return next; });
      }
    },
    [target, apiPrefix],
  );

  const allRawPages: ChatPage[] = [
    ...olderPages,
    ...(latestPageData !== undefined ? [latestPageData] : []),
  ];

  const pages = useMemo(() => {
    const seen = new Set<string>();
    const deduped = allRawPages.map(page => {
      const msgs = (page.messages ?? []).filter(msg => !seen.has(msg.id) && !deletedIds.has(msg.id));
      msgs.forEach(msg => seen.add(msg.id));
      return msgs;
    });

    // Append unconfirmed optimistic messages after the last page
    const unconfirmed = optimisticMessages.filter(m => !seen.has(m.id) && !deletedIds.has(m.id));
    if (unconfirmed.length > 0) {
      if (deduped.length === 0) {
        deduped.push(unconfirmed);
      } else {
        deduped[deduped.length - 1] = [...deduped[deduped.length - 1], ...unconfirmed];
      }
    }

    return deduped;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRawPages, optimisticMessages, deletedIds]);

  const isLoading = latestLoading && latestPageData === undefined;

  return {
    pages,
    latestPage: latestPageIndex,
    isLoading,
    loadOlderPage,
    sendMessage,
    deleteMessage,
  };
}
