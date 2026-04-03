import React, { useState } from 'react';
import { Plus, Flag, ChevronDown, ChevronRight, X, Edit2 } from 'lucide-react';
import { T } from '../lib/theme';
import { useTimeline, type Milestone, type MilestoneEpic } from '../hooks/useTimeline';
import { useBoard } from '../hooks/useBoard';
import { useSprints } from '../hooks/useSprints';
import MilestoneModal from './MilestoneModal';
import EpicModal from './EpicModal';
import IssueLinkDropdown from './IssueLinkDropdown';

interface Props {
  projectSlug: string;
  userLogin: string;
}

type ModalState = Milestone | 'create' | null;

// ── Status helpers ────────────────────────────────────────────────────────────

function statusColor(status: Milestone['status']): string {
  if (status === 'completed') return T.statusOnline;
  if (status === 'in-progress') return T.accent;
  return T.textMuted;
}

function statusLabel(status: Milestone['status']): string {
  if (status === 'in-progress') return 'In Progress';
  if (status === 'completed') return 'Completed';
  return 'Planned';
}

function sortMilestones(milestones: Milestone[]): Milestone[] {
  const order: Record<Milestone['status'], number> = { 'in-progress': 0, 'planned': 1, 'completed': 2 };
  return [...milestones].sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === 'planned') {
      if (!a.targetDate && !b.targetDate) return 0;
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return a.targetDate.localeCompare(b.targetDate);
    }
    return 0;
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Epic Section ──────────────────────────────────────────────────────────────

function EpicSection({ epic, epicIssues, unlinkableIssues, onEditEpic, onRemoveEpic, onLinkIssueToEpic, onUnlinkIssue }: {
  epic: MilestoneEpic;
  epicIssues: Array<{ id: string; title: string }>;
  unlinkableIssues: Array<{ id: string; title: string }>;
  onEditEpic: (epic: MilestoneEpic) => void;
  onRemoveEpic: (epicId: string) => void;
  onLinkIssueToEpic: (issueId: string, epicId: string) => void;
  onUnlinkIssue: (issueId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, display: 'flex', alignItems: 'center', padding: 0 }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        <span style={{ color: T.accentText, fontSize: '12px', fontWeight: 600, flex: 1 }}>{epic.title}</span>
        <button
          onClick={() => onEditEpic(epic)}
          title="Edit epic"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, display: 'flex', alignItems: 'center', padding: '2px' }}
        >
          <Edit2 size={10} />
        </button>
        <span style={{ color: T.textFaint, fontSize: '10px', fontFamily: T.fontMono }}>{epicIssues.length}</span>
        <button onClick={() => onRemoveEpic(epic.id)} title="Remove epic" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textFaint, display: 'flex', alignItems: 'center', padding: '2px' }}>
          <X size={11} />
        </button>
      </div>
      {!collapsed && (
        <div style={{ paddingLeft: '18px' }}>
          {epicIssues.map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.borderMuted, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: T.textFaint, fontFamily: T.fontMono, fontSize: '10px', flexShrink: 0 }}>{i.id}</span>
              <span style={{ color: T.textSecond, fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
              <button onClick={() => onUnlinkIssue(i.id)} title="Unlink" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textFaint, display: 'flex', alignItems: 'center', padding: '2px', opacity: 0.6 }}>
                <X size={10} />
              </button>
            </div>
          ))}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setShowLinkDropdown(v => !v)}
              style={{ background: 'none', border: `1px dashed ${T.borderMuted}`, color: T.textMuted, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer', marginTop: '3px' }}
            >
              + Link issue
            </button>
            {showLinkDropdown && (
              <IssueLinkDropdown
                issues={unlinkableIssues}
                onSelect={id => onLinkIssueToEpic(id, epic.id)}
                onClose={() => setShowLinkDropdown(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Milestone Card ────────────────────────────────────────────────────────────

function MilestoneCard({ milestone, sprints, onEdit, onDelete, allIssues, projectSlug, onPatchMilestone, mutateMilestones, mutateBoard, onOpenEpicModal }: {
  milestone: Milestone;
  sprints: ReturnType<typeof useSprints>['sprints'];
  onEdit: () => void;
  onDelete: () => void;
  allIssues: ReturnType<typeof useBoard>['issues'];
  projectSlug: string;
  onPatchMilestone: (m: Milestone, patch: Partial<Milestone>) => Promise<void>;
  mutateMilestones: () => void;
  mutateBoard: () => void;
  onOpenEpicModal: (epic: MilestoneEpic | 'create') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDirectLinkDropdown, setShowDirectLinkDropdown] = useState(false);

  const sprint = sprints.find(s => s.id === milestone.sprintId);

  // Countdown progress
  const today = Date.now();
  const createdMs = new Date(milestone.createdAt).getTime();
  const targetMs = milestone.targetDate ? new Date(milestone.targetDate + 'T00:00:00').getTime() : null;
  const countdownPct = targetMs && milestone.status !== 'completed'
    ? Math.max(0, Math.min(1, (today - createdMs) / (targetMs - createdMs)))
    : milestone.status === 'completed' ? 1 : null;

  // Issue counts
  const milestoneIssues = allIssues.filter(i => i.milestoneId === milestone.id);
  const directIssues = milestoneIssues.filter(i => !i.epicId);
  const doneCount = milestoneIssues.filter(i => i.columnId === 'done' || i.columnId.includes('done') || i.columnId.includes('complet')).length;

  // Issues not yet linked to this milestone (for link dropdown)
  const unlinkableIssues = allIssues.filter(i => i.milestoneId !== milestone.id);

  async function patchIssue(issueId: string, patch: Record<string, unknown>) {
    await fetch(`/api/jellybean/data/projects/${projectSlug}/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    mutateBoard();
  }

  async function handleRemoveEpic(epicId: string) {
    const updated = milestone.epics.filter(e => e.id !== epicId);
    await onPatchMilestone(milestone, { epics: updated });
    // Clear epicId on all issues that belonged to this epic
    const affected = allIssues.filter(i => i.epicId === epicId);
    await Promise.allSettled(affected.map(i => patchIssue(i.id, { epicId: null })));
  }

  async function handleLinkDirect(issueId: string) {
    await patchIssue(issueId, { milestoneId: milestone.id, epicId: null });
  }

  async function handleLinkToEpic(issueId: string, epicId: string) {
    await patchIssue(issueId, { milestoneId: milestone.id, epicId });
  }

  async function handleUnlinkIssue(issueId: string) {
    await patchIssue(issueId, { milestoneId: null, epicId: null });
  }

  return (
    <div
      style={{
        background: T.bgCard,
        backdropFilter: T.glassBlur,
        WebkitBackdropFilter: T.glassBlur,
        border: T.glassBorder,
        borderRadius: '8px',
        marginBottom: '6px',
        position: 'relative',
        zIndex: expanded ? 10 : 1,
      }}
    >
      {/* Card header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '12px 14px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(milestone.status), flexShrink: 0 }} />
          <span style={{ color: T.textPrimary, fontSize: '13px', fontWeight: 600, flex: 1 }}>{milestone.title}</span>
          {sprint && (
            <span style={{ background: T.accentBg, color: T.accentText, borderRadius: '10px', padding: '2px 8px', fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {sprint.name}
            </span>
          )}
          {milestone.targetDate && (
            <span style={{ color: T.textMuted, fontSize: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDate(milestone.targetDate)}</span>
          )}
          {expanded ? <ChevronDown size={12} color={T.textFaint} /> : <ChevronRight size={12} color={T.textFaint} />}
        </div>

        {milestone.description && (
          <p style={{ color: T.textSecond, fontSize: '12px', margin: '4px 0 0 18px', display: '-webkit-box', WebkitLineClamp: expanded ? 10 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {milestone.description}
          </p>
        )}

        {/* Status + issue count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', marginLeft: '18px' }}>
          <span style={{ color: T.textFaint, fontSize: '10px', fontWeight: 600, letterSpacing: '.06em', fontFamily: T.fontMono }}>{statusLabel(milestone.status)}</span>
          {milestoneIssues.length > 0 && (
            <span style={{ color: T.textMuted, fontSize: '10px', fontFamily: T.fontMono }}>
              {doneCount}/{milestoneIssues.length} done
            </span>
          )}
        </div>

        {/* Countdown progress bar */}
        {countdownPct !== null && targetMs !== null && (
          <div style={{ marginTop: '8px', marginLeft: '18px' }}>
            <div style={{ height: '3px', borderRadius: '2px', background: T.bgInput, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${countdownPct * 100}%`,
                background: countdownPct > 0.9 ? T.dangerText : countdownPct > 0.7 ? T.accentAmber : statusColor(milestone.status),
                borderRadius: '2px',
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ color: T.textFaint, fontSize: '9px', fontFamily: T.fontMono, marginTop: '2px', display: 'block' }}>
              {Math.round(countdownPct * 100)}% of time elapsed to {formatDate(milestone.targetDate!)}
            </span>
          </div>
        )}
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <div style={{ borderTop: T.glassBorder, padding: '12px 14px 14px' }}>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button onClick={e => { e.stopPropagation(); onEdit(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: T.bgInput, border: `1px solid ${T.borderMuted}`, color: T.textSecond, padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>
              <Edit2 size={10} /> Edit
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: T.dangerBg, border: 'none', color: T.dangerText, padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>
              <X size={10} /> Delete
            </button>
          </div>

          {/* Direct issues */}
          <p style={{ color: T.textMuted, fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', marginBottom: '6px', fontFamily: T.fontMono }}>DIRECTLY LINKED ISSUES</p>
          {directIssues.length === 0 && (
            <p style={{ color: T.textFaint, fontSize: '11px', marginBottom: '6px' }}>None yet</p>
          )}
          {directIssues.map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.borderMuted, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: T.textFaint, fontFamily: T.fontMono, fontSize: '10px', flexShrink: 0 }}>{i.id}</span>
              <span style={{ color: T.textSecond, fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
              <button onClick={() => void handleUnlinkIssue(i.id)} title="Unlink" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textFaint, display: 'flex', alignItems: 'center', padding: '2px', opacity: 0.6 }}>
                <X size={10} />
              </button>
            </div>
          ))}
          <div style={{ position: 'relative', display: 'inline-block', marginTop: '4px', marginBottom: '16px' }}>
            <button
              onClick={() => setShowDirectLinkDropdown(v => !v)}
              style={{ background: 'none', border: `1px dashed ${T.borderMuted}`, color: T.textMuted, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
            >
              + Link issue
            </button>
            {showDirectLinkDropdown && (
              <IssueLinkDropdown
                issues={unlinkableIssues}
                onSelect={id => void handleLinkDirect(id)}
                onClose={() => setShowDirectLinkDropdown(false)}
              />
            )}
          </div>

          {/* Epics */}
          <p style={{ color: T.textMuted, fontSize: '10px', fontWeight: 600, letterSpacing: '.08em', marginBottom: '6px', fontFamily: T.fontMono }}>EPICS</p>
          {milestone.epics.length === 0 && (
            <p style={{ color: T.textFaint, fontSize: '11px', marginBottom: '6px' }}>No epics — add one to group related issues</p>
          )}
          {milestone.epics.map(epic => (
            <EpicSection
              key={epic.id}
              epic={epic}
              epicIssues={allIssues.filter(i => i.epicId === epic.id).map(i => ({ id: i.id, title: i.title }))}
              unlinkableIssues={unlinkableIssues.map(i => ({ id: i.id, title: i.title }))}
              onEditEpic={e => onOpenEpicModal(e)}
              onRemoveEpic={(epicId) => void handleRemoveEpic(epicId)}
              onLinkIssueToEpic={(issueId, epicId) => void handleLinkToEpic(issueId, epicId)}
              onUnlinkIssue={(issueId) => void handleUnlinkIssue(issueId)}
            />
          ))}

          {/* Add epic */}
          <button
            onClick={() => onOpenEpicModal('create')}
            style={{ background: 'none', border: `1px dashed ${T.borderMuted}`, color: T.textMuted, borderRadius: '4px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer', marginTop: '4px' }}
          >
            + Add epic
          </button>
        </div>
      )}
    </div>
  );
}

// ── GoalsView ─────────────────────────────────────────────────────────────────

type EpicModalState = { milestone: Milestone; epic: MilestoneEpic | 'create' } | null;

export default function GoalsView({ projectSlug, userLogin: _userLogin }: Props) {
  const { milestones, mutate: mutateMilestones } = useTimeline(projectSlug);
  const { issues, mutate: mutateBoard } = useBoard(projectSlug);
  const { sprints } = useSprints(projectSlug);
  const [modal, setModal] = useState<ModalState>(null);
  const [epicModal, setEpicModal] = useState<EpicModalState>(null);

  const sorted = sortMilestones(milestones);

  async function handlePatchMilestone(m: Milestone, patch: Partial<Milestone>) {
    const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/timeline/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) mutateMilestones();
  }

  async function handleDeleteMilestone(m: Milestone) {
    if (!confirm(`Delete milestone "${m.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/timeline/${m.id}`, { method: 'DELETE' });
    if (res.ok) mutateMilestones();
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bgPage }}>
      {/* Milestone cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flag size={14} color={T.textMuted} />
            <span style={{ color: T.textPrimary, fontSize: '13px', fontWeight: 600 }}>Milestones</span>
            <span style={{ color: T.textFaint, fontSize: '12px' }}>({milestones.length})</span>
          </div>
          <button
            onClick={() => setModal('create')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: T.glowShadow }}
          >
            <Plus size={13} /> New Milestone
          </button>
        </div>

        {milestones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ color: T.textFaint, fontSize: '13px', margin: '0 0 16px' }}>No milestones yet — add one to get started</p>
            <button
              onClick={() => setModal('create')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.accent, border: 'none', color: '#fff', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: T.glowShadow }}
            >
              <Plus size={14} /> New Milestone
            </button>
          </div>
        ) : (
          sorted.map(m => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              sprints={sprints}
              onEdit={() => setModal(m)}
              onDelete={() => void handleDeleteMilestone(m)}
              allIssues={issues}
              projectSlug={projectSlug}
              onPatchMilestone={handlePatchMilestone}
              mutateMilestones={mutateMilestones}
              mutateBoard={mutateBoard}
              onOpenEpicModal={epic => setEpicModal({ milestone: m, epic })}
            />
          ))
        )}
      </div>

      {modal !== null && (
        <MilestoneModal
          projectSlug={projectSlug}
          milestone={modal === 'create' ? null : modal}
          mutate={mutateMilestones}
          sprints={sprints}
          onClose={() => setModal(null)}
        />
      )}

      {epicModal !== null && (
        <EpicModal
          projectSlug={projectSlug}
          milestone={epicModal.milestone}
          epic={epicModal.epic === 'create' ? null : epicModal.epic}
          mutate={mutateMilestones}
          onClose={() => setEpicModal(null)}
        />
      )}
    </div>
  );
}
