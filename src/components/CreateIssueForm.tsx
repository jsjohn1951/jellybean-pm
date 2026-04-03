import React, { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import type { Collaborator } from '../hooks/useCollaborators';
import type { Sprint } from '../hooks/useSprints';
import { useMutation } from '../lib/mutation-context';
import { uploadAttachmentToIssue } from '../lib/attachments';
import type { IssueAttachment } from '../hooks/useBoard';
import AssigneeSelect from './AssigneeSelect';
import Select from './Select';
import { T } from '../lib/theme';

interface Props {
  projectSlug: string;
  collaborators: Collaborator[];
  sprints: Sprint[];
  onCreated: () => void;
  onCancel: () => void;
  onConflict?: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CreateIssueForm({ projectSlug, collaborators, sprints, onCreated, onCancel, onConflict }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [labelsStr, setLabelsStr] = useState('');
  const [sprintId, setSprintId] = useState<string | null>(() => sprints.find(s => s.status === 'active')?.id ?? null);
  const [deadlineDays, setDeadlineDays] = useState('');
  const [deadlineHours, setDeadlineHours] = useState('');
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { withMutation } = useMutation();

  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setFileQueue(prev => [...prev, ...files]);
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeFile(idx: number) {
    setFileQueue(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    const labels = labelsStr.split(',').map(l => l.trim()).filter(Boolean);
    const days = parseInt(deadlineDays, 10) || 0;
    const hours = parseInt(deadlineHours, 10) || 0;
    const deadline = days > 0 || hours > 0 ? { days, hours } : null;

    try {
      await withMutation(async () => {
        // 1. Create the issue
        const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), description, priority, assignees, labels, sprintId, deadline }),
        });
        if (res.status === 409) { setError('Conflict — please try again'); onConflict?.(); return; }
        if (!res.ok) throw new Error('Failed to create issue');

        // 2. Upload queued attachments sequentially
        if (fileQueue.length > 0) {
          const { id: issueId } = await res.json() as { id: string };
          let uploaded: IssueAttachment[] = [];
          for (const file of fileQueue) {
            const entry = await uploadAttachmentToIssue(projectSlug, issueId, file, 'me', uploaded);
            uploaded = [...uploaded, entry];
          }
        }

        onCreated();
      });
    } catch {
      setError('Failed to create issue — please try again');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textPrimary, borderRadius: '5px', padding: '7px 9px', fontSize: '12px', width: '100%', boxSizing: 'border-box' as const };
  const labelStyle: React.CSSProperties = { color: T.textMuted, fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', display: 'block', marginBottom: '4px' };
  const numInput: React.CSSProperties = { ...inputStyle, width: '100%' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={labelStyle}>TITLE *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Issue title" style={inputStyle} autoFocus />
      </div>
      <div>
        <label style={labelStyle}>DESCRIPTION</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Optional description" style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle}>PRIORITY</label>
          <Select
            value={priority}
            onChange={setPriority}
            options={['low', 'medium', 'high', 'critical'].map(p => ({ value: p, label: p }))}
          />
        </div>
        <div>
          <label style={labelStyle}>SPRINT</label>
          <Select
            value={sprintId ?? ''}
            onChange={v => setSprintId(v || null)}
            placeholder="— Backlog —"
            options={[
              { value: '', label: '— Backlog —' },
              ...sprints.map(s => ({
                value: s.id,
                label: s.name + (s.status === 'active' ? ' ●' : s.status === 'completed' ? ' ✓' : ''),
              })),
            ]}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>ASSIGNEES</label>
        <AssigneeSelect value={assignees} collaborators={collaborators} onChange={setAssignees} />
      </div>
      <div>
        <label style={labelStyle}>LABELS</label>
        <input value={labelsStr} onChange={e => setLabelsStr(e.target.value)}
          placeholder="bug, auth, ui" style={inputStyle} />
      </div>

      {/* Deadline */}
      <div>
        <label style={labelStyle}>DEADLINE (optional)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <input
              type="number" min="0" placeholder="Days"
              value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)}
              style={numInput}
            />
          </div>
          <div>
            <input
              type="number" min="0" max="23" placeholder="Hours"
              value={deadlineHours} onChange={e => setDeadlineHours(e.target.value)}
              style={numInput}
            />
          </div>
        </div>
        <p style={{ color: T.textFaint, fontSize: '10px', marginTop: '3px' }}>
          Timer starts when issue is moved to In Progress
        </p>
      </div>

      {/* File attachments queue */}
      <div>
        <label style={labelStyle}>ATTACHMENTS</label>
        {fileQueue.map((file, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', padding: '5px 8px', background: T.bgInput, borderRadius: '5px', border: `1px solid ${T.borderSubtle}` }}>
            <Paperclip size={12} color={T.textMuted} />
            <span style={{ flex: 1, color: T.textPrimary, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
            <span style={{ color: T.textFaint, fontSize: '10px', flexShrink: 0, fontFamily: T.fontMono }}>{formatBytes(file.size)}</span>
            <button type="button" onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, display: 'flex', alignItems: 'center', padding: '2px' }}>
              <X size={12} />
            </button>
          </div>
        ))}
        <input ref={fileRef} type="file" multiple onChange={addFiles} style={{ display: 'none' }} />
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ background: T.bgInput, color: T.textSecond, border: `1px solid ${T.borderMuted}`, padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', marginTop: '2px' }}>
          + Attach files
        </button>
      </div>

      {error && <p style={{ color: '#f87171', fontSize: '12px', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
        <button type="button" onClick={onCancel}
          style={{ background: T.bgInput, color: T.textSecond, border: `1px solid ${T.borderMuted}`, padding: '7px 16px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          style={{ background: saving ? T.accentHover : T.accent, color: '#fff', border: 'none', padding: '7px 16px', borderRadius: '5px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '12px', boxShadow: saving ? 'none' : T.glowShadow, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Creating…' : 'Create Issue'}
        </button>
      </div>
    </form>
  );
}
