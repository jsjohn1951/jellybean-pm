import React, { useEffect, useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useIsMobile } from '../lib/useIsMobile';
import { useIssue } from '../hooks/useIssue';
import { useCollaborators } from '../hooks/useCollaborators';
import type { useBoard, IssueDeadline } from '../hooks/useBoard';
import IssueHeader from './IssueHeader';
import IssueDescription from './IssueDescription';
import IssueMetadata from './IssueMetadata';
import AttachmentList, { type Attachment, type PendingAttachment } from './AttachmentList';
import CommentSection from './CommentSection';
import ActivityLog from './ActivityLog';
import { useSprints } from '../hooks/useSprints';
import { useToast } from '../lib/toast';
import { T } from '../lib/theme';
import { useMutation } from '../lib/mutation-context';

interface Props { issueId: string; projectSlug: string; onClose: () => void; mutate: ReturnType<typeof useBoard>['mutate']; }

interface Draft {
  title: string;
  description: string;
  assignees: string[];
  labels: string[];
  sprintId: string | null;
  deadline: IssueDeadline | null;
  attachments: Attachment[];
  pendingAttachments: PendingAttachment[];
}

function DeadlineRow({ deadline, onChange }: { deadline: IssueDeadline | null; onChange: (d: IssueDeadline | null) => void }) {
  const [days, setDays] = useState(String(deadline?.days ?? ''));
  const [hours, setHours] = useState(String(deadline?.hours ?? ''));

  function commit(d: string, h: string) {
    const dv = parseInt(d, 10) || 0;
    const hv = parseInt(h, 10) || 0;
    onChange(dv > 0 || hv > 0 ? { days: dv, hours: hv } : null);
  }

  const inputS: React.CSSProperties = { background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textPrimary, borderRadius: '5px', padding: '5px 7px', fontSize: '12px', width: '100%', boxSizing: 'border-box' };
  const labelS: React.CSSProperties = { color: T.textMuted, fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', display: 'block', marginBottom: '4px' };

  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={labelS}>DEADLINE</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <input
          type="number" min="0" placeholder="Days"
          value={days}
          onChange={e => setDays(e.target.value)}
          onBlur={() => commit(days, hours)}
          style={inputS}
        />
        <input
          type="number" min="0" max="23" placeholder="Hours"
          value={hours}
          onChange={e => setHours(e.target.value)}
          onBlur={() => commit(days, hours)}
          style={inputS}
        />
      </div>
    </div>
  );
}

export default function IssueDetailModal({ issueId, projectSlug, onClose, mutate }: Props) {
  const { issue, isLoading, error, mutate: refreshIssue } = useIssue(projectSlug, issueId);
  const collaborators = useCollaborators();
  const { sprints } = useSprints(projectSlug);
  const { show } = useToast();
  const { withMutation } = useMutation();
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingTimer, setResettingTimer] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (issue && !draft) {
      setDraft({
        title: issue.title,
        description: issue.description,
        assignees: [...issue.assignees],
        labels: [...issue.labels],
        sprintId: issue.sprintId ?? null,
        deadline: issue.deadline ?? null,
        attachments: [...issue.attachments],
        pendingAttachments: [],
      });
    }
  }, [issue]);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleSave() {
    if (!issue || !draft) return;
    setSaving(true);
    const url = `/api/jellybean/data/projects/${projectSlug}/issues/${issueId}`;
    try {
      await withMutation(async () => {
        let currentAttachments = [...draft.attachments];
        for (const pending of draft.pendingAttachments) {
          const entry = { name: pending.name, path: pending.path, uploadedBy: 'me', uploadedAt: pending.uploadedAt };
          currentAttachments = [...currentAttachments, entry];
          const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              _binaryUpload: { path: pending.path, content: pending.base64 },
              attachments: currentAttachments,
              activity: [{ type: 'attachment_added', by: 'me', at: pending.uploadedAt }],
            }),
          });
          if (!res.ok) throw new Error('attachment upload failed');
        }

        const now = new Date().toISOString();
        const changes: Record<string, unknown> = {};
        const activity: Array<Record<string, string>> = [];

        if (draft.title.trim() !== issue.title) {
          changes['title'] = draft.title.trim();
          activity.push({ type: 'title_edited', by: 'me', at: now });
        }
        if (draft.description !== issue.description) changes['description'] = draft.description;
        if (JSON.stringify(draft.assignees) !== JSON.stringify(issue.assignees)) {
          changes['assignees'] = draft.assignees;
          changes['assignee'] = draft.assignees[0] ?? null; // keep legacy field in sync
          activity.push({ type: 'assigned', by: 'me', at: now, to: draft.assignees.join(', ') });
        }
        if (JSON.stringify(draft.labels) !== JSON.stringify(issue.labels)) {
          changes['labels'] = draft.labels;
          activity.push({ type: 'label_changed', by: 'me', at: now });
        }
        if ((draft.sprintId ?? null) !== (issue.sprintId ?? null)) {
          changes['sprintId'] = draft.sprintId;
          activity.push({ type: 'sprint_changed', by: 'me', at: now, to: draft.sprintId ?? '' });
        }
        if (JSON.stringify(draft.deadline) !== JSON.stringify(issue.deadline ?? null)) {
          changes['deadline'] = draft.deadline;
        }
        const removedPaths = issue.attachments
          .filter(a => !draft.attachments.some(da => da.path === a.path))
          .map(a => a.path);
        if (removedPaths.length > 0 && draft.pendingAttachments.length === 0) {
          changes['attachments'] = draft.attachments;
        }

        if (Object.keys(changes).length > 0 || activity.length > 0) {
          const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...changes, ...(activity.length ? { activity } : {}) }),
          });
          if (!res.ok) throw new Error('save failed');
        }

        if (removedPaths.length > 0) {
          void Promise.allSettled(
            removedPaths.map(path => fetch(`/api/jellybean/data/files/${path}`, { method: 'DELETE' }))
          );
        }

        await mutate();
        onClose();
      });
    } catch {
      show('Failed to save — please try again', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete issue ${issueId}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await withMutation(async () => {
        const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/issues/${issueId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete failed');
        await mutate();
        onClose();
      });
    } catch {
      show('Failed to delete issue — please try again', 'error');
      setDeleting(false);
    }
  }

  async function handleResetTimer() {
    setResettingTimer(true);
    try {
      await withMutation(async () => {
        const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/issues/${issueId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timerStartedAt: null, timerAccumulatedMs: 0 }),
        });
        if (!res.ok) throw new Error('reset failed');
        await mutate();
        void refreshIssue();
      });
    } catch {
      show('Failed to reset timer', 'error');
    } finally {
      setResettingTimer(false);
    }
  }

  if (isLoading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
      <p style={{ color: T.textSecond, fontSize: '13px' }}>Loading…</p>
    </div>
  );
  if (error || !issue || !draft) return null;

  const hasTimer = issue.timerAccumulatedMs > 0 || issue.timerStartedAt !== null;
  const btnBase: React.CSSProperties = { border: 'none', cursor: 'pointer', borderRadius: '5px', padding: '7px 16px', fontSize: '12px', fontWeight: 600 };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 40 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: T.bgPanel,
        backdropFilter: T.glassBlur,
        WebkitBackdropFilter: T.glassBlur,
        borderLeft: isMobile ? 'none' : T.glassBorder,
        width: isMobile ? '100vw' : '480px',
        maxWidth: isMobile ? '100vw' : '90vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textFaint, cursor: 'pointer', float: 'right', display: 'inline-flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
          <IssueHeader issue={issue} title={draft.title}
            onChange={title => setDraft(d => d ? { ...d, title } : d)} />
          <IssueDescription value={draft.description}
            onChange={description => setDraft(d => d ? { ...d, description } : d)} />
          <IssueMetadata
            assignees={draft.assignees}
            labels={draft.labels}
            collaborators={collaborators}
            sprintId={draft.sprintId}
            sprints={sprints}
            onChangeAssignees={assignees => setDraft(d => d ? { ...d, assignees } : d)}
            onChangeLabels={labels => setDraft(d => d ? { ...d, labels } : d)}
            onChangeSprintId={sprintId => setDraft(d => d ? { ...d, sprintId } : d)}
          />
          <DeadlineRow
            deadline={draft.deadline}
            onChange={deadline => setDraft(d => d ? { ...d, deadline } : d)}
          />
          {hasTimer && (
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: T.textSecond, fontSize: '11px', fontFamily: T.fontMono }}>
                Timer: {issue.timerStartedAt ? '⏱ running' : '⏸ paused'}
              </span>
              <button
                onClick={() => void handleResetTimer()}
                disabled={resettingTimer}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textMuted, padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}
              >
                <RotateCcw size={11} />
                {resettingTimer ? 'Resetting…' : 'Reset timer'}
              </button>
            </div>
          )}
          <AttachmentList
            attachments={draft.attachments}
            pendingAttachments={draft.pendingAttachments}
            issueId={issueId}
            onAddPending={p => setDraft(d => d ? { ...d, pendingAttachments: [...d.pendingAttachments, p] } : d)}
            onRemoveSaved={path => setDraft(d => d ? { ...d, attachments: d.attachments.filter(a => a.path !== path) } : d)}
            onRemovePending={path => setDraft(d => d ? { ...d, pendingAttachments: d.pendingAttachments.filter(a => a.path !== path) } : d)}
          />
          <hr style={{ borderColor: T.borderSubtle, margin: '20px 0' }} />
          <CommentSection activity={issue.activity} projectSlug={projectSlug} issueId={issueId}
            onCommented={() => { void refreshIssue(); }} />
          <hr style={{ borderColor: T.borderSubtle, margin: '20px 0' }} />
          <ActivityLog activity={issue.activity} />
        </div>
        <div style={{ borderTop: T.glassBorder, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgPanel }}>
          <button onClick={() => void handleDelete()} disabled={deleting}
            style={{ ...btnBase, background: T.dangerBg, color: T.dangerText, opacity: deleting ? 0.5 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete issue'}
          </button>
          <button onClick={() => void handleSave()} disabled={saving || !draft.title.trim()}
            style={{ ...btnBase, background: T.accent, color: '#fff', boxShadow: T.glowShadow, opacity: (saving || !draft.title.trim()) ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save & close'}
          </button>
        </div>
      </div>
    </div>
  );
}
