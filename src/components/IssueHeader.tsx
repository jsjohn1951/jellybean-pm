import React, { useState } from 'react';
import type { Issue } from '../hooks/useBoard';
import { T } from '../lib/theme';

interface Props { issue: Issue; title: string; onChange: (title: string) => void; }

export default function IssueHeader({ issue, title, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  function startEdit() { setDraft(title); setEditing(true); }
  function commitEdit() { onChange(draft.trim() || title); setEditing(false); }

  const PRIORITY_BG: Record<string, string> = { critical: '#450a0a', high: '#7f1d1d', medium: '#431407', low: '#1a2e1a' };
  const PRIORITY_FG: Record<string, string> = { critical: '#fca5a5', high: '#fca5a5', medium: '#fed7aa', low: '#86efac' };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ color: T.textMuted, fontSize: '11px', fontFamily: 'monospace' }}>{issue.id}</span>
        <span style={{ background: PRIORITY_BG[issue.priority] ?? T.bgInput, color: PRIORITY_FG[issue.priority] ?? T.textSecond, fontSize: '10px', padding: '2px 7px', borderRadius: '3px' }}>{issue.priority}</span>
      </div>
      {editing
        ? <input value={draft} onChange={e => setDraft(e.target.value)} onBlur={commitEdit}
            onKeyDown={e => e.key === 'Enter' && commitEdit()}
            autoFocus style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.accent}`, color: T.textPrimary, borderRadius: '5px', padding: '6px 8px', fontSize: '16px', fontWeight: 600, boxSizing: 'border-box' as const }} />
        : <h2 onClick={startEdit} style={{ color: T.textPrimary, fontSize: '16px', fontWeight: 600, cursor: 'text', margin: 0 }}>{title}</h2>}
    </div>
  );
}
