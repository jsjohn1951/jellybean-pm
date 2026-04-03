import React, { useEffect, useRef, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { T } from '../lib/theme';
import { useMutation } from '../lib/mutation-context';
import { useToast } from '../lib/toast';
import Select from './Select';
import type { Milestone } from '../hooks/useTimeline';
import type { Sprint } from '../hooks/useSprints';

interface Props {
  projectSlug: string;
  milestone: Milestone | null;
  mutate: () => void;
  sprints: Sprint[];
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

export default function MilestoneModal({ projectSlug, milestone, mutate, sprints, onClose }: Props) {
  const isEdit = milestone !== null;
  const { withMutation } = useMutation();
  const { toasts, show, dismiss } = useToast();

  const [title, setTitle] = useState(milestone?.title ?? '');
  const [description, setDescription] = useState(milestone?.description ?? '');
  const [targetDate, setTargetDate] = useState(milestone?.targetDate ?? '');
  const [sprintId, setSprintId] = useState(milestone?.sprintId ?? '');
  const [status, setStatus] = useState<Milestone['status']>(milestone?.status ?? 'planned');

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const base = `/api/jellybean/data/projects/${projectSlug}/timeline`;

  async function handleSave() {
    if (!title.trim()) { show('Title is required', 'error'); return; }
    await withMutation(async () => {
      const payload = {
        title: title.trim(),
        description,
        targetDate: targetDate || null,
        sprintId: sprintId || null,
        status,
      };
      const res = isEdit
        ? await fetch(`${base}/${milestone.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { show('Failed to save milestone', 'error'); return; }
      mutate();
      onClose();
    });
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm(`Delete milestone "${milestone.title}"?`)) return;
    await withMutation(async () => {
      const res = await fetch(`${base}/${milestone.id}`, { method: 'DELETE' });
      if (!res.ok) { show('Failed to delete milestone', 'error'); return; }
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
              {isEdit ? 'Edit Milestone' : 'New Milestone'}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>TITLE *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Milestone title…" />
            </div>

            <div>
              <label style={labelStyle}>DESCRIPTION</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="What does this milestone represent?"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>TARGET DATE</label>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>STATUS</label>
                <Select
                  value={status}
                  onChange={v => setStatus(v as Milestone['status'])}
                  options={[
                    { value: 'planned', label: 'Planned' },
                    { value: 'in-progress', label: 'In Progress' },
                    { value: 'completed', label: 'Completed' },
                  ]}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>SPRINT</label>
              <Select
                value={sprintId}
                onChange={setSprintId}
                placeholder="No sprint"
                options={[
                  { value: '', label: 'No sprint' },
                  ...sprints.map(s => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
            {isEdit ? (
              <button onClick={handleDelete} style={{ background: T.dangerBg, border: 'none', color: T.dangerText, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Trash2 size={13} /> Delete
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onClose} style={{ background: 'none', border: `1px solid ${T.borderMuted}`, color: T.textMuted, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => void handleSave()} style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                {isEdit ? 'Save Changes' : 'Create Milestone'}
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
