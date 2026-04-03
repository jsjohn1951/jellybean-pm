import React, { useEffect, useRef, useState } from 'react';
import { T } from '../../lib/theme';
import type { ChatAttachment } from '../../lib/chat-types';

interface Props {
  onSend: (text: string, attachments: ChatAttachment[]) => Promise<void>;
  disabled?: boolean;
  convId: string;
}

const EMOJIS = [
  '😊','😂','❤️','👍','👎','🎉','🔥','✅','❌','⚠️',
  '💡','🚀','🐛','📎','🔗','💬','👋','🙏','💪','⭐',
  '🎯','📝','🔧','⚙️','🏆','📊','💻','🌟','🎨','🔍',
  '📌','✨','🎁','💰','🌈','🤔','😅','🥳','💯','🎤',
  '📅','📋','🔒','🔓','🌐','📱','💾','📂','🗂️','📧',
  '🔔','⏰','🎧','🌙','☀️','🌊','🍀','🎶','🎵','🎸',
];

export function ChatMessageInput({ onSend, disabled, convId }: Props) {
  const [text, setText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [hovered, setHovered] = useState<{ [key: string]: boolean }>({});

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Wraps both the emoji button and the picker so click-outside excludes both
  const emojiContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEmoji) return;
    function handleClickOutside(e: MouseEvent) {
      if (emojiContainerRef.current && !emojiContainerRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmoji]);

  function setHover(id: string, val: boolean) {
    setHovered(prev => ({ ...prev, [id]: val }));
  }

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function wrapSelection(prefix: string, suffix: string, placeholder: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.slice(start, end);
    const inner = selected || placeholder;
    const newText = text.slice(0, start) + prefix + inner + suffix + text.slice(end);
    setText(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + inner.length);
    }, 0);
  }

  function handleBold() { wrapSelection('**', '**', 'bold'); }
  function handleItalic() { wrapSelection('_', '_', 'italic'); }
  function handleCode() { wrapSelection('`', '`', 'code'); }
  function handleCodeBlock() { wrapSelection('```\n', '\n```', 'code'); }
  function handleLink() {
    const url = window.prompt('Enter URL:');
    if (!url) return;
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.slice(start, end);
    const linkText = selected || 'link text';
    const insertion = `[${linkText}](${url})`;
    const newText = text.slice(0, start) + insertion + text.slice(end);
    setText(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start, start + insertion.length);
    }, 0);
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    // Keep picker open for consecutive emoji selection — closes on click-outside only
    setTimeout(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newAttachments: ChatAttachment[] = files.map(file => ({
      name: file.name,
      path: `files/chat/${convId}/${Date.now()}-${file.name}`,
      size: file.size,
      mimeType: file.type,
    }));
    setPendingAttachments(prev => [...prev, ...newAttachments]);
    // Reset file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeAttachment(index: number) {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if (sending || disabled) return;
    if (text.trim().length === 0 && pendingAttachments.length === 0) return;
    setSending(true);
    try {
      await onSend(text.trim(), pendingAttachments);
      setText('');
      setPendingAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter alone → send; Shift+Enter → insert newline (default textarea behavior)
      e.preventDefault();
      void handleSend();
    }
  }

  const toolbarBtnStyle = (id: string): React.CSSProperties => ({
    background: hovered[id] ? T.bgCard : T.bgInput,
    color: T.textMuted,
    border: `1px solid ${T.borderSubtle}`,
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: T.fontPrimary,
    lineHeight: '1.6',
    transition: 'background 0.1s',
  });

  const sendDisabled = sending || !!disabled || (text.trim().length === 0 && pendingAttachments.length === 0);

  return (
    <div
      style={{
        position: 'relative',
        borderTop: `1px solid ${T.borderSubtle}`,
        padding: '8px',
      }}
    >
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <button
          style={toolbarBtnStyle('bold')}
          onMouseEnter={() => setHover('bold', true)}
          onMouseLeave={() => setHover('bold', false)}
          onClick={handleBold}
          title="Bold (Ctrl+B)"
          type="button"
        >
          <strong>B</strong>
        </button>
        <button
          style={toolbarBtnStyle('italic')}
          onMouseEnter={() => setHover('italic', true)}
          onMouseLeave={() => setHover('italic', false)}
          onClick={handleItalic}
          title="Italic"
          type="button"
        >
          <em>I</em>
        </button>
        <button
          style={toolbarBtnStyle('code')}
          onMouseEnter={() => setHover('code', true)}
          onMouseLeave={() => setHover('code', false)}
          onClick={handleCode}
          title="Inline code"
          type="button"
        >
          {'<>'}
        </button>
        <button
          style={toolbarBtnStyle('codeblock')}
          onMouseEnter={() => setHover('codeblock', true)}
          onMouseLeave={() => setHover('codeblock', false)}
          onClick={handleCodeBlock}
          title="Code block"
          type="button"
        >
          {'{ }'}
        </button>
        <button
          style={toolbarBtnStyle('link')}
          onMouseEnter={() => setHover('link', true)}
          onMouseLeave={() => setHover('link', false)}
          onClick={handleLink}
          title="Insert link"
          type="button"
        >
          🔗
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        rows={1}
        placeholder="Message… (Enter to send, Shift+Enter for newline)"
        disabled={disabled || sending}
        onChange={e => {
          setText(e.target.value);
          resizeTextarea();
        }}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: T.textPrimary,
          fontSize: T.fontSizeBase,
          resize: 'none',
          fontFamily: T.fontPrimary,
          boxSizing: 'border-box',
          lineHeight: '1.5',
          overflow: 'hidden',
        }}
      />

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {pendingAttachments.map((att, i) => (
            <div
              key={`${att.path}-${i}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: T.bgInput,
                border: `1px solid ${T.borderSubtle}`,
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '12px',
                color: T.textSecond,
              }}
            >
              <span>📎</span>
              <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.name}
              </span>
              <button
                onClick={() => removeAttachment(i)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: T.textFaint,
                  padding: '0 2px',
                  fontSize: '12px',
                  lineHeight: 1,
                }}
                type="button"
                title="Remove attachment"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || sending}
            style={{
              background: hovered['attach'] ? T.bgCard : 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: T.textMuted,
              fontSize: '16px',
              padding: '2px 6px',
              borderRadius: '4px',
              transition: 'background 0.1s',
            }}
            onMouseEnter={() => setHover('attach', true)}
            onMouseLeave={() => setHover('attach', false)}
            type="button"
            title="Attach file"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Emoji button + picker — anchored together so click-outside excludes both */}
          <div ref={emojiContainerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowEmoji(prev => !prev)}
              disabled={disabled || sending}
              style={{
                background: showEmoji ? T.accentBg : (hovered['emoji'] ? T.bgCard : 'transparent'),
                border: 'none',
                cursor: 'pointer',
                color: T.textMuted,
                fontSize: '16px',
                padding: '2px 6px',
                borderRadius: '4px',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHover('emoji', true)}
              onMouseLeave={() => setHover('emoji', false)}
              type="button"
              title="Emoji"
            >
              😊
            </button>

            {/* Emoji picker — positioned above the button, left-aligned to it */}
            {showEmoji && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 4px)',
                  left: '0',
                  zIndex: 100,
                  background: T.bgPanel,
                  border: T.glassBorder,
                  borderRadius: '8px',
                  padding: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: '2px',
                  boxShadow: T.glowShadow,
                }}
              >
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '4px',
                      borderRadius: '4px',
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.accentBg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={() => void handleSend()}
          disabled={sendDisabled}
          style={{
            background: sendDisabled ? T.bgInput : T.accent,
            color: sendDisabled ? T.textFaint : '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 14px',
            fontSize: T.fontSizeBase,
            cursor: sendDisabled ? 'not-allowed' : 'pointer',
            fontFamily: T.fontPrimary,
            fontWeight: 600,
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => {
            if (!sendDisabled) (e.currentTarget as HTMLButtonElement).style.background = T.accentHover;
          }}
          onMouseLeave={e => {
            if (!sendDisabled) (e.currentTarget as HTMLButtonElement).style.background = T.accent;
          }}
          type="button"
        >
          {sending ? '…' : 'Send →'}
        </button>
      </div>
    </div>
  );
}
