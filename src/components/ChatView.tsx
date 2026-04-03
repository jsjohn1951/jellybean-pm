import React, { useEffect, useMemo } from 'react';
import useSWR from 'swr';
import config from 'virtual:jellybean-pm/config';
import { T } from '../lib/theme';
import type { ChatTarget } from '../lib/chat-types';
import { dmConvId } from '../lib/chat-types';
import { useChat } from '../hooks/useChat';
import { useChatState } from '../hooks/useChatState';
import { useCollaborators } from '../hooks/useCollaborators';
import { apiFetch } from '../lib/fetcher';
import { ChatMessageList } from './chat/ChatMessageList';
import { ChatMessageInput } from './chat/ChatMessageInput';

interface Props {
  target: ChatTarget;
  userLogin: string;
  chatState?: {
    openDms: string[];
    unreadCounts: Record<string, number>;
    openDm: (login: string) => void;
    closeDm: (login: string) => void;
    markRead: (convId: string, lastMsgId: string) => void;
  };
  projectSlug?: string;
}

export default function ChatView({ target, userLogin, chatState: chatStateProp, projectSlug }: Props) {
  const isAdmin = userLogin === config.storage.repo.split('/')[0];
  const chat = useChat(target, userLogin, projectSlug);
  const _ownChatState = useChatState(userLogin);
  const chatState = chatStateProp ?? _ownChatState;
  const collaborators = useCollaborators();

  const avatarUrls = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const c of collaborators) {
      map[c.login] = c.avatar_url;
    }
    return map;
  }, [collaborators]);

  const convId =
    target === 'group'
      ? (projectSlug ? `project:${projectSlug}` : 'group')
      : dmConvId(userLogin, (target as { dm: string }).dm);
  const otherLogin = target !== 'group' ? (target as { dm: string }).dm : null;

  // Poll the other participant's lastRead so we can show Seen when they open the chat
  const { data: otherUserState } = useSWR<{ openDms: string[]; lastRead: Record<string, string> }>(
    otherLogin ? `/api/jellybean/data/chat/user-state/${otherLogin}` : null,
    apiFetch,
    { refreshInterval: 15000, dedupingInterval: 14000, revalidateOnFocus: false },
  );
  const otherLastReadMsgId = otherLogin ? (otherUserState?.lastRead?.[convId] ?? '') : undefined;

  const allMessages = chat.pages.flat();
  const lastMsgId = allMessages[allMessages.length - 1]?.id ?? '';

  useEffect(() => {
    chatState.markRead(convId, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  useEffect(() => {
    if (lastMsgId) {
      chatState.markRead(convId, lastMsgId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMsgId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden', background: T.bgPage }}>
      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${T.borderSubtle}`,
          color: T.textPrimary,
          fontWeight: 600,
          fontSize: T.fontSizeBase,
          fontFamily: T.fontPrimary,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {target !== 'group' && (
          avatarUrls[(target as { dm: string }).dm]
            ? <img src={avatarUrls[(target as { dm: string }).dm]} alt={(target as { dm: string }).dm} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>
                {(target as { dm: string }).dm.charAt(0).toUpperCase()}
              </div>
        )}
        <span>
          {target === 'group'
            ? '# General'
            : (target as { dm: string }).dm}
        </span>
      </div>

      {/* Message list — fills remaining space */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ChatMessageList
          pages={chat.pages}
          isLoading={chat.isLoading}
          onScrollTop={chat.loadOlderPage}
          avatarUrls={avatarUrls}
          currentUserLogin={userLogin}
          onDeleteMessage={chat.deleteMessage}
          isAdmin={isAdmin}
          otherLastReadMsgId={otherLastReadMsgId}
        />
      </div>

      {/* Input */}
      <ChatMessageInput onSend={async (text, att) => { chat.sendMessage(text, att); }} convId={convId} />
    </div>
  );
}
