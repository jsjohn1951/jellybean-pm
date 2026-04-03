import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { T } from '../../lib/theme';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '../../lib/chat-types';

interface Props {
  pages: ChatMessageType[][];
  isLoading: boolean;
  onScrollTop: () => void;
  avatarUrls?: Record<string, string>;
  currentUserLogin?: string;
  onDeleteMessage?: (msgId: string) => void;
  isAdmin?: boolean;
  otherLastReadMsgId?: string;
}

export function ChatMessageList({ pages, isLoading, onScrollTop, avatarUrls, currentUserLogin, onDeleteMessage, isAdmin, otherLastReadMsgId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const throttleRef = useRef<boolean>(false);

  const allMessages: ChatMessageType[] = pages.flat();

  const lastMessageId = allMessages.length > 0 ? allMessages[allMessages.length - 1].id : null;

  // Index of the last message authored by the current user (for Sent/Seen indicator)
  const lastMineIndex = useMemo(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].authorLogin === currentUserLogin) return i;
    }
    return -1;
  }, [allMessages, currentUserLogin]);

  // Scroll to bottom when a new message arrives
  useEffect(() => {
    if (lastMessageId !== null && lastMessageId !== lastMessageIdRef.current) {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
      lastMessageIdRef.current = lastMessageId;
    }
  }, [lastMessageId]);

  // Restore scroll position after older pages are prepended
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && containerRef.current) {
      const newScrollHeight = containerRef.current.scrollHeight;
      containerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [pages.length]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || throttleRef.current) return;

    if (containerRef.current.scrollTop < 40) {
      throttleRef.current = true;
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
      onScrollTop();
      setTimeout(() => {
        throttleRef.current = false;
      }, 1000);
    }
  }, [onScrollTop]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        overflowY: 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {isLoading && (
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            color: T.textFaint,
            fontSize: '12px',
          }}
        >
          Loading…
        </div>
      )}

      {allMessages.length === 0 && !isLoading && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.textFaint,
            fontSize: '13px',
          }}
        >
          No messages yet. Say hello!
        </div>
      )}

      {allMessages.map((message, index) => (
        <ChatMessage
          key={message.id}
          message={message}
          prevMessage={index > 0 ? allMessages[index - 1] : undefined}
          avatarUrl={avatarUrls?.[message.authorLogin]}
          isMine={currentUserLogin !== undefined && message.authorLogin === currentUserLogin}
          isPending={message.id.startsWith('pending-')}
          onDelete={onDeleteMessage && (isAdmin || message.authorLogin === currentUserLogin) ? () => onDeleteMessage(message.id) : undefined}
          isLastMine={index === lastMineIndex}
          otherLastReadMsgId={otherLastReadMsgId}
        />
      ))}
    </div>
  );
}
