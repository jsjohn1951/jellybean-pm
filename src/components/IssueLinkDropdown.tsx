import React, { useState } from 'react';
import { T } from '../lib/theme';

interface Props {
  issues: Array<{ id: string; title: string }>;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function IssueLinkDropdown({ issues, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const filtered = issues
    .filter(i =>
      i.title.toLowerCase().includes(query.toLowerCase()) ||
      i.id.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 10);

  return (
    <div style={{
      position: 'absolute', zIndex: 100, top: '100%', left: 0,
      background: T.bgPanel, border: T.glassBorder, borderRadius: '6px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '280px', maxHeight: '200px', overflowY: 'auto',
    }}>
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search issues…"
        style={{ width: '100%', background: T.bgInput, border: 'none', borderBottom: `1px solid ${T.borderMuted}`, color: T.textPrimary, padding: '7px 10px', fontSize: '12px', boxSizing: 'border-box' }}
      />
      {filtered.length === 0 ? (
        <div style={{ padding: '10px', color: T.textFaint, fontSize: '12px' }}>No unlinked issues</div>
      ) : (
        filtered.map(i => (
          <div
            key={i.id}
            onClick={() => { onSelect(i.id); onClose(); }}
            style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '7px 10px', cursor: 'pointer', fontSize: '12px' }}
            onMouseEnter={e => (e.currentTarget.style.background = T.accentBg)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ color: T.textFaint, fontFamily: T.fontMono, fontSize: '10px', flexShrink: 0 }}>{i.id}</span>
            <span style={{ color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
          </div>
        ))
      )}
      <button onClick={onClose} style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: T.textMuted, padding: '6px', cursor: 'pointer', fontSize: '11px', borderTop: `1px solid ${T.borderSubtle}` }}>
        Cancel
      </button>
    </div>
  );
}
