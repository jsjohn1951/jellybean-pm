import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { T } from '../lib/theme';
import { useMutation } from '../lib/mutation-context';
import { useToast } from '../lib/toast';
import { useBoard } from '../hooks/useBoard';
import { useCollaborators } from '../hooks/useCollaborators';
import type { Sprint } from '../hooks/useSprints';
import type { Milestone, MilestoneEpic } from '../hooks/useTimeline';
import type { CalendarTask } from './CalendarGrid';
import CreateIssueForm from './CreateIssueForm';
import IssueLinkDropdown from './IssueLinkDropdown';
import Select from './Select';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PopoverContext =
  | { type: 'cell'; date: Date }
  | { type: 'milestone'; task: CalendarTask }
  | { type: 'epic'; task: CalendarTask };

type Step = 'select' | 'create-issue' | 'create-milestone' | 'add-epic' | 'attach-issue';

interface Props {
  context: PopoverContext;
  projectSlug: string;
  milestones: Milestone[];
  sprints: Sprint[];
  onMutateBoard: () => void;
  onMutateMilestones: () => void;
  onClose: () => void;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: T.bgInput, border: `1px solid ${T.borderMuted}`,
  color: T.textPrimary, borderRadius: '6px', padding: '7px 10px', fontSize: '13px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', color: T.textMuted, fontSize: '11px', fontWeight: 600,
  letterSpacing: '.05em', marginBottom: '5px',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'block', width: '100%', background: T.bgInput,
  border: `1px solid ${T.borderMuted}`, color: T.textPrimary,
  fontSize: '13px', padding: '12px 16px', textAlign: 'left',
  cursor: 'pointer', borderRadius: '6px', fontFamily: T.fontPrimary,
};

// ── CalendarActionModal ───────────────────────────────────────────────────────

export default function CalendarActionModal({
  context,
  projectSlug,
  milestones,
  sprints,
  onMutateBoard,
  onMutateMilestones,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>('select');
  const { withMutation } = useMutation();
  const { toasts, show, dismiss } = useToast();
  const collaborators = useCollaborators();

  // Resolve parent milestone for epic/attach-issue steps
  const parentMilestone = useMemo<Milestone | null>(() => {
    if (context.type === 'milestone') {
      const rawId = context.task.id.replace('milestone-', '');
      return milestones.find(m => m.id === rawId) ?? null;
    }
    if (context.type === 'epic') {
      return milestones.find(m => m.id === context.task.milestoneId) ?? null;
    }
    return null;
  }, [context, milestones]);

  const parentEpicId = useMemo<string | null>(() => {
    if (context.type === 'epic') return context.task.id.replace('epic-', '');
    return null;
  }, [context]);

  // Escape key
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // ── Context title for select step ─────────────────────────────────────────────

  function contextLabel(): string {
    if (context.type === 'cell') return 'Calendar';
    return context.task.title;
  }

  // ── Select step ──────────────────────────────────────────────────────────────

  function renderSelect() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {context.type === 'cell' && (
          <>
            <button
              style={actionBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.background = T.accentBg)}
              onMouseLeave={e => (e.currentTarget.style.background = T.bgInput)}
              onClick={() => setStep('create-issue')}
            >
              New Issue
            </button>
            <button
              style={actionBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.background = T.accentBg)}
              onMouseLeave={e => (e.currentTarget.style.background = T.bgInput)}
              onClick={() => setStep('create-milestone')}
            >
              New Milestone
            </button>
          </>
        )}
        {context.type === 'milestone' && (
          <button
            style={actionBtnStyle}
            onMouseEnter={e => (e.currentTarget.style.background = T.accentBg)}
            onMouseLeave={e => (e.currentTarget.style.background = T.bgInput)}
            onClick={() => setStep('add-epic')}
          >
            Add Epic
          </button>
        )}
        {context.type === 'epic' && (
          <>
            <button
              style={actionBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.background = T.accentBg)}
              onMouseLeave={e => (e.currentTarget.style.background = T.bgInput)}
              onClick={() => setStep('create-issue')}
            >
              New Issue
            </button>
            <button
              style={actionBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.background = T.accentBg)}
              onMouseLeave={e => (e.currentTarget.style.background = T.bgInput)}
              onClick={() => setStep('attach-issue')}
            >
              Attach Existing Issue
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Create milestone form ─────────────────────────────────────────────────────

  function MilestoneForm() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [sprintId, setSprintId] = useState('');
    const [status, setStatus] = useState<'planned' | 'in-progress' | 'completed'>('planned');

    async function handleSave() {
      if (!title.trim()) { show('Title is required', 'error'); return; }
      await withMutation(async () => {
        const res = await fetch(
          `/api/jellybean/data/projects/${projectSlug}/timeline`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: title.trim(),
              description,
              targetDate: targetDate || null,
              sprintId: sprintId || null,
              status,
            }),
          }
        );
        if (!res.ok) { show('Failed to create milestone', 'error'); return; }
        onMutateMilestones();
        onClose();
      });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={labelStyle}>TITLE *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Milestone title…" />
        </div>
        <div>
          <label style={labelStyle}>DESCRIPTION</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="What does this milestone represent?" />
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
              onChange={v => setStatus(v as 'planned' | 'in-progress' | 'completed')}
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
          <button onClick={() => setStep('select')}
            style={{ background: 'none', border: `1px solid ${T.borderMuted}`, color: T.textMuted, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
            Back
          </button>
          <button onClick={() => void handleSave()}
            style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Create Milestone
          </button>
        </div>
      </div>
    );
  }

  // ── Add epic form ─────────────────────────────────────────────────────────────

  function EpicForm() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

    function toggleAssignee(login: string) {
      setSelectedAssignees(prev =>
        prev.includes(login) ? prev.filter(a => a !== login) : [...prev, login]
      );
    }

    async function handleSave() {
      if (!title.trim()) { show('Title is required', 'error'); return; }
      if (!parentMilestone) { show('Parent milestone not found', 'error'); return; }
      await withMutation(async () => {
        const newEpic: MilestoneEpic = {
          id: `epic-${Date.now()}`,
          title: title.trim(),
          description: description.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          assignees: selectedAssignees.length ? selectedAssignees : undefined,
          issueIds: [],
        };
        const res = await fetch(
          `/api/jellybean/data/projects/${projectSlug}/timeline/${parentMilestone.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ epics: [...parentMilestone.epics, newEpic] }),
          }
        );
        if (!res.ok) { show('Failed to create epic', 'error'); return; }
        onMutateMilestones();
        onClose();
      });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={labelStyle}>TITLE *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Epic title…" />
        </div>
        <div>
          <label style={labelStyle}>DESCRIPTION</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="What does this epic represent?" />
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
                <label key={c.login} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedAssignees.includes(c.login)}
                    onChange={() => toggleAssignee(c.login)}
                    style={{ accentColor: T.accent, cursor: 'pointer' }} />
                  <span style={{ color: T.textPrimary, fontSize: '13px' }}>{c.login}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
          <button onClick={() => setStep('select')}
            style={{ background: 'none', border: `1px solid ${T.borderMuted}`, color: T.textMuted, borderRadius: '6px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
            Back
          </button>
          <button onClick={() => void handleSave()}
            style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Create Epic
          </button>
        </div>
      </div>
    );
  }

  // ── Attach issue step ─────────────────────────────────────────────────────────

  function AttachIssueStep() {
    const { issues } = useBoard(projectSlug);
    const unlinkedIssues = issues
      .filter(i => !i.epicId)
      .map(i => ({ id: i.id, title: i.title }));

    async function handleSelect(issueId: string) {
      if (!parentMilestone || !parentEpicId) return;
      await withMutation(async () => {
        const res = await fetch(
          `/api/jellybean/data/projects/${projectSlug}/issues/${issueId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ milestoneId: parentMilestone.id, epicId: parentEpicId }),
          }
        );
        if (!res.ok) { show('Failed to attach issue', 'error'); return; }
        onMutateBoard();
        onClose();
      });
    }

    return (
      <div style={{ position: 'relative', minHeight: '120px' }}>
        <IssueLinkDropdown
          issues={unlinkedIssues}
          onSelect={(id) => void handleSelect(id)}
          onClose={() => setStep('select')}
        />
      </div>
    );
  }

  // ── Step titles ───────────────────────────────────────────────────────────────

  const STEP_TITLES: Record<Step, string> = {
    'select': contextLabel(),
    'create-issue': 'New Issue',
    'create-milestone': 'New Milestone',
    'add-epic': 'New Epic',
    'attach-issue': 'Attach Existing Issue',
  };

  // ── Render ────────────────────────────────────────────────────────────────────

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
        <div style={{
          background: T.bgPanel, border: `1px solid ${T.borderSubtle}`,
          borderRadius: '10px', padding: '24px',
          width: step === 'select' ? '320px' : '480px',
          maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto',
          transition: 'width 0.15s ease',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {step !== 'select' && (
                <button
                  onClick={() => setStep('select')}
                  style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                  aria-label="Back"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <h2 style={{ color: T.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0 }}>
                {STEP_TITLES[step]}
              </h2>
            </div>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
              <X size={18} />
            </button>
          </div>

          {/* Step content */}
          {step === 'select' && renderSelect()}
          {step === 'create-issue' && (
            <CreateIssueForm
              projectSlug={projectSlug}
              collaborators={collaborators}
              sprints={sprints}
              onCreated={() => { onMutateBoard(); onClose(); }}
              onCancel={() => setStep('select')}
              onConflict={() => { onMutateBoard(); }}
            />
          )}
          {step === 'create-milestone' && <MilestoneForm />}
          {step === 'add-epic' && <EpicForm />}
          {step === 'attach-issue' && <AttachIssueStep />}
        </div>
      </div>

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => (
          <div key={t.id} onClick={() => dismiss(t.id)}
            style={{
              background: t.type === 'error' ? T.dangerBg : T.accentBg,
              border: `1px solid ${t.type === 'error' ? '#7f1d1d' : T.accent}`,
              color: t.type === 'error' ? T.dangerText : T.accentText,
              borderRadius: '6px', padding: '10px 14px', fontSize: '13px',
              cursor: 'pointer', maxWidth: '320px',
            }}>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
