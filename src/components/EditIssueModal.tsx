import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { T } from '../lib/theme';
import { useMutation } from '../lib/mutation-context';
import { useToast } from '../lib/toast';
import { useCollaborators } from '../hooks/useCollaborators';
import { useSprints } from '../hooks/useSprints';
import type { Issue } from '../hooks/useBoard';

interface Props {
  projectSlug: string;
  issue: Issue;
  mutate: () => void;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: T.bgInput, border: `1px solid ${T.borderMuted}`,
  color: T.textPrimary, borderRadius: '6px', padding: '7px 10px', fontSize: '13px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', color: T.textMuted, fontSize: '11px', fontWeight: 600,
  letterSpacing: '.05em', marginBottom: '5px',
};

export default function EditIssueModal({ projectSlug, issue, mutate, onClose }: Props) {
  const { withMutation } = useMutation();
  const { toasts, show, dismiss } = useToast();
  const collaborators = useCollaborators();
  const { sprints } = useSprints(projectSlug);

  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? '');
  const [priority, setPriority] = useState(issue.priority);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(issue.assignees);
  const [labelsStr, setLabelsStr] = useState(issue.labels.join(', '));
  const [sprintId, setSprintId] = useState<string | null>(issue.sprintId);
  const [deadlineDays, setDeadlineDays] = useState(String(issue.deadline?.days ?? ''));
  const [deadlineHours, setDeadlineHours] = useState(String(issue.deadline?.hours ?? ''));

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  function toggleAssignee(login: string) {
    setSelectedAssignees(prev =>
      prev.includes(login) ? prev.filter(a => a !== login) : [...prev, login]
    );
  }

  async function handleSave() {
    if (!title.trim()) { show('Title is required', 'error'); return; }
    const days = parseInt(deadlineDays, 10) || 0;
    const hours = parseInt(deadlineHours, 10) || 0;
    const deadline = days > 0 || hours > 0 ? { days, hours } : null;
    const labels = labelsStr.split(',').map(l => l.trim()).filter(Boolean);

    await withMutation(async () => {
      const res = await fetch(
        `/api/jellybean/data/projects/${projectSlug}/issues/${issue.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description,
            priority,
            assignees: selectedAssignees,
            labels,
            sprintId,
            deadline,
          }),
        }
      );
      if (!res.ok) { show('Failed to save issue', 'error'); return; }
      mutate();
      onClose();
    });
  }

  const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: '16px',
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          style={{
            background: T.bgPanel, border: `1px solid ${T.borderSubtle}`,
            borderRadius: '10px', padding: '24px',
            width: '480px', maxWidth: '100%',
            maxHeight: '90vh', overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ color: T.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0 }}>
              Edit Issue
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>TITLE *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Issue title…" />
            </div>

            <div>
              <label style={labelStyle}>DESCRIPTION</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Describe the issue…"
              />
            </div>

            <div>
              <label style={labelStyle}>PRIORITY</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Issue['priority'])} style={inputStyle}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>SPRINT</label>
              <select value={sprintId ?? ''} onChange={e => setSprintId(e.target.value || null)} style={inputStyle}>
                <option value="">— Backlog —</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>ASSIGNEES</label>
              {collaborators.length === 0 ? (
                <p style={{ color: T.textFaint, fontSize: '12px', margin: 0 }}>No collaborators available</p>
              ) : (
                <div style={{ maxHeight: '120px', overflowY: 'auto', border: `1px solid ${T.borderMuted}`, borderRadius: '6px', padding: '4px 0' }}>
                  {collaborators.map(c => (
                    <label key={c.login} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedAssignees.includes(c.login)}
                        onChange={() => toggleAssignee(c.login)}
                        style={{ accentColor: T.accent, cursor: 'pointer' }}
                      />
                      <span style={{ color: T.textPrimary, fontSize: '13px' }}>{c.login}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>LABELS</label>
              <input
                value={labelsStr}
                onChange={e => setLabelsStr(e.target.value)}
                style={inputStyle}
                placeholder="bug, frontend, …"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>DEADLINE DAYS</label>
                <input type="number" min="0" value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)} style={inputStyle} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>DEADLINE HOURS</label>
                <input type="number" min="0" max="23" value={deadlineHours} onChange={e => setDeadlineHours(e.target.value)} style={inputStyle} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${T.borderMuted}`, color: T.textMuted, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => void handleSave()} style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            style={{
              background: t.type === 'error' ? T.dangerBg : T.accentBg,
              border: `1px solid ${t.type === 'error' ? '#7f1d1d' : T.accent}`,
              color: t.type === 'error' ? T.dangerText : T.accentText,
              borderRadius: '6px', padding: '10px 14px', fontSize: '13px',
              cursor: 'pointer', maxWidth: '320px',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
