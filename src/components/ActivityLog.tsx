import React from 'react';
import type { IssueActivity } from '../hooks/useBoard';
import { T } from '../lib/theme';

const VERBS: Record<string, string> = {
  created: 'created this issue',
  moved: 'moved from {from} → {to}',
  assigned: 'assigned to {to}',
  attachment_added: 'added attachment',
  priority_changed: 'changed priority to {to}',
  title_edited: 'edited title',
  label_changed: 'updated labels',
};

function describe(a: IssueActivity): string {
  const tpl = VERBS[a.type] ?? a.type;
  return tpl.replace('{from}', a.from ?? '').replace('{to}', a.to ?? '');
}

interface Props { activity: IssueActivity[]; }

export default function ActivityLog({ activity }: Props) {
  const events = [...activity].filter(a => a.type !== 'comment').reverse();
  if (events.length === 0) return null;

  return (
    <div>
      <p style={{ color: T.textMuted, fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', marginBottom: '10px' }}>ACTIVITY</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {events.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ width: 5, height: 5, background: T.borderMuted, borderRadius: '50%', marginTop: 5, flexShrink: 0 }} />
            <div>
              <span style={{ color: T.textFaint, fontSize: '10px' }}>{new Date(a.at).toLocaleDateString()} · {a.by}</span>
              <p style={{ color: T.textSecond, fontSize: '11px', margin: '1px 0 0' }}>{describe(a)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
