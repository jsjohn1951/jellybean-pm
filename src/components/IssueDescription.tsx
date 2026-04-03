import React from 'react';
import { T } from '../lib/theme';

interface Props { value: string; onChange: (v: string) => void; }

export default function IssueDescription({ value, onChange }: Props) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ color: T.textMuted, fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', marginBottom: '6px' }}>DESCRIPTION</p>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={5}
        style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textPrimary, borderRadius: '5px', padding: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' as const }} />
    </div>
  );
}
