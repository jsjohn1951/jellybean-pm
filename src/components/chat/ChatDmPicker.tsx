import React, { useEffect, useRef, useState } from 'react';
import { T } from '../../lib/theme';
import { useCollaborators } from '../../hooks/useCollaborators';

interface Props {
  onSelect: (login: string) => void;
  onClose: () => void;
  openDms: string[];
  userLogin: string;
}

export function ChatDmPicker({ onSelect, onClose, openDms, userLogin }: Props) {
  const collaborators = useCollaborators();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Autofocus search input on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filtered = collaborators.filter(c => {
    if (c.login === userLogin) return false;
    if (openDms.includes(c.login)) return false;
    if (query.trim()) {
      return c.login.toLowerCase().includes(query.trim().toLowerCase());
    }
    return true;
  });

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSelect(login: string) {
    onSelect(login);
    onClose();
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: T.bgPanel,
          border: T.glassBorder,
          borderRadius: '8px',
          width: '320px',
          maxWidth: 'calc(100vw - 32px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: T.glowShadow,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${T.borderSubtle}`,
          }}
        >
          <span
            style={{
              color: T.textPrimary,
              fontWeight: 600,
              fontSize: T.fontSizeBase,
              fontFamily: T.fontPrimary,
            }}
          >
            New Direct Message
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: T.textMuted,
              fontSize: '16px',
              padding: '2px 4px',
              borderRadius: '4px',
              lineHeight: 1,
            }}
            type="button"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.borderSubtle}` }}>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by username..."
            style={{
              width: '100%',
              background: T.bgInput,
              border: `1px solid ${T.borderMuted}`,
              borderRadius: '5px',
              color: T.textPrimary,
              fontSize: T.fontSizeBase,
              fontFamily: T.fontPrimary,
              padding: '6px 10px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Collaborator list */}
        <div
          style={{
            overflowY: 'auto',
            maxHeight: '300px',
            padding: '6px 0',
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                color: T.textFaint,
                fontSize: T.fontSizeSmall,
                padding: '16px',
                textAlign: 'center',
                fontFamily: T.fontPrimary,
              }}
            >
              No collaborators found
            </div>
          ) : (
            filtered.map(collab => (
              <CollabRow
                key={collab.login}
                login={collab.login}
                avatarUrl={collab.avatar_url}
                onSelect={handleSelect}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface CollabRowProps {
  login: string;
  avatarUrl: string;
  onSelect: (login: string) => void;
}

function CollabRow({ login, avatarUrl, onSelect }: CollabRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onSelect(login)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        background: hovered ? T.accentBg : 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 16px',
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
      type="button"
    >
      <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={avatarUrl}
          alt={login}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            (e.currentTarget.nextSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
          }}
        />
        <span style={{ display: 'none', color: T.accentText, fontSize: '13px', fontWeight: 600 }}>
          {login[0]?.toUpperCase()}
        </span>
      </div>
      <span
        style={{
          color: T.textPrimary,
          fontSize: T.fontSizeBase,
          fontFamily: T.fontPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {login}
      </span>
    </button>
  );
}
