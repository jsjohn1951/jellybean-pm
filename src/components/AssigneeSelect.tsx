import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { Collaborator } from '../hooks/useCollaborators';
import { T } from '../lib/theme';

interface Props {
  value: string[];
  collaborators: Collaborator[];
  onChange: (logins: string[]) => void;
}

function avatarSrc(login: string, collaborators: Collaborator[]) {
  return collaborators.find(c => c.login === login)?.avatar_url
    || `https://github.com/${login}.png?size=32`;
}

export default function AssigneeSelect({ value, collaborators, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  function add(login: string) {
    if (!value.includes(login)) onChange([...value, login]);
  }

  function remove(login: string) {
    onChange(value.filter(l => l !== login));
  }

  const unselected = collaborators.filter(c => !value.includes(c.login));
  // Include any value entries not in collaborators list (legacy / external)
  const allSelected = [
    ...value.filter(l => !collaborators.some(c => c.login === l)),
    ...collaborators.filter(c => value.includes(c.login)).map(c => c.login),
  ];

  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '7px 10px', cursor: 'pointer', fontSize: '12px',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger: selected chips + open dropdown button */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px',
          background: T.bgInput, border: `1px solid ${T.borderMuted}`, borderRadius: '5px',
          padding: '5px 8px', minHeight: '34px', cursor: 'pointer',
        }}
        onClick={() => setOpen(o => !o)}
      >
        {allSelected.length === 0 && (
          <span style={{ color: T.textMuted, fontSize: '12px', flex: 1 }}>— unassigned —</span>
        )}
        {allSelected.map(login => (
          <span
            key={login}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: T.accentBg, borderRadius: '12px',
              padding: '2px 6px 2px 3px', fontSize: '11px', color: T.accentText,
            }}
          >
            <img
              src={avatarSrc(login, collaborators)}
              alt={login}
              style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
            />
            {login}
            <span
              onClick={e => { e.stopPropagation(); remove(login); }}
              style={{ display: 'inline-flex', cursor: 'pointer', color: T.textMuted, marginLeft: '1px' }}
            >
              <X size={10} />
            </span>
          </span>
        ))}
        <ChevronDown size={12} style={{ color: T.textMuted, marginLeft: 'auto', flexShrink: 0 }} />
      </div>

      {/* Dropdown — shows only unselected collaborators */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
          background: T.bgPanel, border: `1px solid ${T.borderMuted}`, borderRadius: '5px',
          maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {unselected.length === 0 ? (
            <div style={{ ...rowBase, color: T.textMuted }}>All collaborators assigned</div>
          ) : (
            unselected.map(c => (
              <div
                key={c.login}
                onClick={() => { add(c.login); }}
                style={rowBase}
                onMouseEnter={e => (e.currentTarget.style.background = T.accentBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <img
                  src={avatarSrc(c.login, collaborators)}
                  alt={c.login}
                  style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
                <span style={{ color: T.textPrimary }}>{c.login}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
