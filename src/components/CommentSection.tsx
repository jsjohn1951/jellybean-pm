import React from 'react';
import type { IssueActivity } from '../hooks/useBoard';
import CommentInput from './CommentInput';
import { T } from '../lib/theme';

interface Props { activity: IssueActivity[]; projectSlug: string; issueId: string; onCommented: () => void; }

export default function CommentSection({ activity, projectSlug, issueId, onCommented }: Props) {
  const comments = [...activity].filter(a => a.type === 'comment').reverse();

  return (
    <div>
      <p style={{ color: T.textMuted, fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', marginBottom: '12px' }}>COMMENTS</p>
      {comments.length === 0 && (
        <p style={{ color: T.textMuted, fontSize: '12px', marginBottom: '12px' }}>No comments yet.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {comments.map((a, i) => (
          <div key={i} style={{ background: T.bgInput, borderRadius: '5px', padding: '10px' }}>
            <span style={{ color: T.textSecond, fontSize: '10px' }}>{new Date(a.at).toLocaleDateString()} · {a.by}</span>
            <p style={{ color: T.textPrimary, fontSize: '12px', margin: '4px 0 0' }}>{a.text}</p>
          </div>
        ))}
      </div>
      <CommentInput projectSlug={projectSlug} issueId={issueId} onCommented={onCommented} />
    </div>
  );
}
