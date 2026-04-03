import React, { useState } from 'react';
import { T } from '../../lib/theme';
import { chatMarkdown } from '../../lib/chatMarkdown';
import type { ChatMessage as ChatMessageType, ChatAttachment } from '../../lib/chat-types';

interface Props {
  message: ChatMessageType;
  prevMessage?: ChatMessageType;
  avatarUrl?: string;
  isMine?: boolean;
  isPending?: boolean;
  onDelete?: () => void;
  isLastMine?: boolean;
  otherLastReadMsgId?: string;
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function AttachmentItem({ attachment, isMine }: { attachment: ChatAttachment; isMine: boolean }) {
  return (
    <a
      href={`/api/jellybean/data/files/${attachment.path}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        color: isMine ? 'rgba(255,255,255,0.85)' : T.accentText,
        fontSize: '12px',
        textDecoration: 'none',
        marginRight: '8px',
      }}
    >
      <span>📎</span>
      <span>{attachment.name}</span>
      <span style={{ opacity: 0.7 }}>({formatSize(attachment.size)})</span>
    </a>
  );
}

function AvatarCircle({ login, avatarUrl }: { login: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={login}
        style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
      />
    );
  }
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        flexShrink: 0,
        background: T.accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: '12px',
        userSelect: 'none',
      }}
    >
      {login.charAt(0).toUpperCase()}
    </div>
  );
}

export function ChatMessage({ message, prevMessage, avatarUrl, isMine = false, isPending = false, onDelete, isLastMine = false, otherLastReadMsgId }: Props) {
  const [hovered, setHovered] = useState(false);

  const isGrouped =
    prevMessage !== undefined &&
    prevMessage.authorLogin === message.authorLogin &&
    new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 5 * 60 * 1000;

  // Seen detection: compare timestamps embedded in message IDs (msg-{ts}-{rand})
  const msgTs = message.id.startsWith('msg-') ? parseInt(message.id.split('-')[1] ?? '0', 10) : 0;
  const otherTs = otherLastReadMsgId?.startsWith('msg-') ? parseInt(otherLastReadMsgId.split('-')[1] ?? '0', 10) : 0;
  const isSeen = isLastMine && !isPending && !!otherLastReadMsgId && otherTs >= msgTs;
  const statusLabel = isPending ? '· sending…' : isLastMine ? (isSeen ? '· Seen' : '· Sent') : null;

  const bubbleBg = isMine ? T.accent : 'rgba(255,255,255,0.07)';
  const bubbleColor = isMine ? '#fff' : T.textPrimary;
  const bubbleRadius = isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px';

  // Wrapper is position:relative + width:fit-content so the button can anchor just outside it
  // without affecting the bubble's layout or text wrapping at all.
  const bubble = (
    <div style={{ position: 'relative', width: 'fit-content', maxWidth: '68%' }}>
      <div
        style={{
          background: bubbleBg,
          color: bubbleColor,
          borderRadius: bubbleRadius,
          padding: '7px 12px',
          opacity: isPending ? 0.65 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <span style={{ fontSize: '13px', lineHeight: '1.5', display: 'block', wordBreak: 'break-word' }}>
          {chatMarkdown(message.text, message.id)}
        </span>
        {message.editedAt && (
          <span style={{ color: isMine ? 'rgba(255,255,255,0.6)' : T.textFaint, fontSize: '11px' }}>
            {' (edited)'}
          </span>
        )}
        {message.attachments.length > 0 && (
          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {message.attachments.map(att => (
              <AttachmentItem key={att.path} attachment={att} isMine={isMine} />
            ))}
          </div>
        )}
      </div>
      {onDelete && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete message"
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            // Sits just outside the bubble wrapper on the appropriate side
            ...(isMine ? { right: 'calc(100% + 6px)' } : { left: 'calc(100% + 6px)' }),
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: T.textFaint,
            fontSize: '15px',
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e05252'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.textFaint; }}
        >
          ×
        </button>
      )}
    </div>
  );

  const hoverProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (isMine) {
    if (isGrouped) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '1px 12px' }} {...hoverProps}>
          {bubble}
          {statusLabel && (
            <span style={{ color: T.textFaint, fontSize: '11px', marginTop: '2px' }}>
              {statusLabel}
            </span>
          )}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '6px 12px 1px' }} {...hoverProps}>
        <span style={{ color: T.textFaint, fontSize: '11px', marginBottom: '3px' }}>
          {formatTime(message.createdAt)}
          {statusLabel && ` ${statusLabel}`}
        </span>
        {bubble}
      </div>
    );
  }

  if (isGrouped) {
    return (
      <div style={{ display: 'flex', padding: '1px 12px 1px 48px' }} {...hoverProps}>
        {bubble}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '8px', padding: '6px 12px 1px', alignItems: 'flex-start' }} {...hoverProps}>
      <AvatarCircle login={message.authorLogin} avatarUrl={avatarUrl} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
          <span style={{ color: T.textPrimary, fontWeight: 600, fontSize: '13px' }}>
            {message.authorLogin}
          </span>
          <span style={{ color: T.textFaint, fontSize: '11px' }}>
            {formatTime(message.createdAt)}
          </span>
        </div>
        {bubble}
      </div>
    </div>
  );
}
