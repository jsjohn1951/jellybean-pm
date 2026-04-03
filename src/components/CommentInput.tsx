import React, { useState } from 'react';
import { T } from '../lib/theme';
import { useMutation } from '../lib/mutation-context';

interface Props { projectSlug: string; issueId: string; onCommented: () => void; }

export default function CommentInput({ projectSlug, issueId, onCommented }: Props) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const { withMutation } = useMutation();

  async function submit() {
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await withMutation(async () => {
        await fetch(`/api/jellybean/data/projects/${projectSlug}/issues/${issueId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity: [{ type: 'comment', by: 'me', text: comment.trim(), at: new Date().toISOString() }] }),
        });
        setComment('');
        onCommented();
      });
    } catch {
      // comment failed — button re-enabled, user can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment…"
        style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textPrimary, borderRadius: '5px', padding: '8px', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' as const }} rows={3} />
      <button onClick={() => void submit()} disabled={saving || !comment.trim()}
        style={{ marginTop: '8px', background: T.accent, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>
        {saving ? 'Saving…' : 'Comment'}
      </button>
    </>
  );
}
