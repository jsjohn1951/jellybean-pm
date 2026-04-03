import React, { useEffect, useRef, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { T } from '../lib/theme';
import { useMutation } from '../lib/mutation-context';
import { useToast } from '../lib/toast';
import { useCollaborators } from '../hooks/useCollaborators';
import type { Milestone, MilestoneEpic } from '../hooks/useTimeline';

interface Props {
  projectSlug: string;
  milestone: Milestone;
  epic: MilestoneEpic | null;
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

export default function EpicModal({ projectSlug, milestone, epic, mutate, onClose }: Props) {
  const isEdit = epic !== null;
  const { withMutation } = useMutation();
  const { toasts, show, dismiss } = useToast();
  const collaborators = useCollaborators();

  const [title, setTitle] = useState(epic?.title ?? '');
  const [description, setDescription] = useState(epic?.description ?? '');
  const [startDate, setStartDate] = useState(epic?.startDate ?? '');
  const [endDate, setEndDate] = useState(epic?.endDate ?? '');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(epic?.assignees ?? []);

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

  const base = `/api/jellybean/data/projects/${projectSlug}/timeline/${milestone.id}`;

  async function handleSave() {
    if (!title.trim()) { show('Title is required', 'error'); return; }
    await withMutation(async () => {
      const updatedEpic: MilestoneEpic = {
        id: epic?.id ?? `epic-${Date.now()}`,
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        assignees: selectedAssignees.length ? selectedAssignees : undefined,
        issueIds: epic?.issueIds ?? [],
      };
      const updatedEpics = isEdit
        ? milestone.epics.map(e => e.id === updatedEpic.id ? updatedEpic : e)
        : [...milestone.epics, updatedEpic];
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epics: updatedEpics }),
      });
      if (!res.ok) { show('Failed to save epic', 'error'); return; }
      mutate();
      onClose();
    });
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm(`Delete epic "${epic.title}"?`)) return;
    await withMutation(async () => {
      const updatedEpics = milestone.epics.filter(e => e.id !== epic.id);
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epics: updatedEpics }),
      });
      if (!res.ok) { show('Failed to delete epic', 'error'); return; }
      mutate();
      onClose();
    });
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          background: T.bgPanel, border: `1px solid ${T.borderSubtle}`,
          borderRadius: '10px', padding: '24px',
          width: '480px', maxWidth: '100%',
          maxHeight: '90vh', overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ color: T.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0 }}>
              {isEdit ? 'Edit Epic' : 'New Epic'}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>TITLE *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Epic title…" />
            </div>

            <div>
              <label style={labelStyle}>DESCRIPTION</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="What does this epic represent?"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>START DATE</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>END DATE</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>ASSIGNEES</label>
              {collaborators.length === 0 ? (
                <p style={{ color: T.textFaint, fontSize: '12px', margin: 0 }}>No collaborators available</p>
              ) : (
                <div style={{ maxHeight: '120px', overflowY: 'auto', border: `1px solid ${T.borderMuted}`, borderRadius: '6px', padding: '4px 0' }}>
                  {collaborators.map(c => (
                    <label
                      key={c.login}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', cursor: 'pointer' }}
                    >
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
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
            {isEdit ? (
              <button onClick={() => void handleDelete()} style={{ background: T.dangerBg, border: 'none', color: T.dangerText, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Trash2 size={13} /> Delete
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onClose} style={{ background: 'none', border: `1px solid ${T.borderMuted}`, color: T.textMuted, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => void handleSave()} style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                {isEdit ? 'Save Changes' : 'Create Epic'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => (
          <div key={t.id} onClick={() => dismiss(t.id)} style={{ background: t.type === 'error' ? T.dangerBg : T.accentBg, border: `1px solid ${t.type === 'error' ? '#7f1d1d' : T.accent}`, color: t.type === 'error' ? T.dangerText : T.accentText, borderRadius: '6px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', maxWidth: '320px' }}>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
