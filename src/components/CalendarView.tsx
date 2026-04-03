import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { T } from '../lib/theme';
import { useTimeline } from '../hooks/useTimeline';
import { useBoard, type Issue } from '../hooks/useBoard';
import { useCollaborators } from '../hooks/useCollaborators';
import { useAssigneeColors } from '../hooks/useAssigneeColors';
import { useSprints } from '../hooks/useSprints';
import CalendarGrid, { type CalendarTask } from './CalendarGrid';
import CalendarActionModal, { type PopoverContext } from './CalendarActionModal';
import EditIssueModal from './EditIssueModal';

interface Props {
  projectSlug: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Assignee Legend ──────────────────────────────────────────────────────────

function AssigneeLegend({
  collaborators,
  assigneeColors,
}: {
  collaborators: { login: string }[];
  assigneeColors: Map<string, string>;
}) {
  if (collaborators.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
      {collaborators.map(c => {
        const color = assigneeColors.get(c.login) ?? T.textMuted;
        return (
          <div key={c.login} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '2px',
              background: color, flexShrink: 0,
            }} />
            <span style={{ color: T.textSecond, fontSize: '11px', fontFamily: T.fontMono }}>
              {c.login}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Issue date calculation ────────────────────────────────────────────────────

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function issueToCalendarTask(
  issue: Issue,
  assigneeColors: Map<string, string>,
  fallbackColor: string,
): CalendarTask | null {
  // Issues with no assignees have no color in the legend — skip them.
  if (issue.assignees.length === 0) return null;

  const color = assigneeColors.get(issue.assignees[0]) ?? fallbackColor;
  const today = dateToYMD(new Date());
  const col = issue.columnId.toLowerCase();

  const isDone = col.includes('done') || col.includes('complet');
  const isInProgress = !isDone && col.includes('progress');
  const isUnderReview = !isDone && !isInProgress && col.includes('review');

  let startDate: string;
  let endDate: string;
  let issueStatus: CalendarTask['issueStatus'];

  if (isInProgress) {
    issueStatus = 'in-progress';
    const timerStart = issue.timerStartedAt ? new Date(issue.timerStartedAt) : new Date();
    startDate = dateToYMD(timerStart);
    if (issue.deadline) {
      const ms = (issue.deadline.days * 24 + issue.deadline.hours) * 3_600_000;
      endDate = dateToYMD(new Date(timerStart.getTime() + ms));
    } else {
      endDate = dateToYMD(new Date(timerStart.getTime() + 86_400_000));
    }
  } else if (isDone) {
    issueStatus = 'done';
    const doneActivity = [...issue.activity]
      .reverse()
      .find(a =>
        a.type === 'move' &&
        (a.to === 'done' || (a.to?.toLowerCase().includes('done')) || (a.to?.toLowerCase().includes('complet')))
      );
    const doneDate = doneActivity
      ? dateToYMD(new Date(doneActivity.at))
      : dateToYMD(new Date(issue.updatedAt));
    startDate = doneDate;
    endDate = doneDate;
  } else if (isUnderReview) {
    issueStatus = 'under-review';
    startDate = today;
    endDate = today;
  } else {
    issueStatus = 'not-started';
    startDate = today;
    endDate = today;
  }

  return {
    id: `issue-${issue.id}`,
    title: issue.title,
    description: issue.description || undefined,
    startDate,
    endDate,
    assignees: issue.assignees,
    color,
    type: 'issue',
    issueStatus,
    columnId: issue.columnId,
    milestoneId: issue.milestoneId ?? undefined,
  };
}

// ── CalendarView ─────────────────────────────────────────────────────────────

export default function CalendarView({ projectSlug }: Props) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const { milestones, mutate: mutateMilestones } = useTimeline(projectSlug);
  const { issues, mutate: mutateBoard } = useBoard(projectSlug);
  const { sprints } = useSprints(projectSlug);
  const collaborators = useCollaborators();
  const assigneeColors = useAssigneeColors(collaborators);

  // ── Modal state ────────────────────────────────────────────────────────────

  const [actionModalContext, setActionModalContext] = useState<PopoverContext | null>(null);
  const [editIssueTarget, setEditIssueTarget] = useState<Issue | null>(null);

  // ── Month navigation ───────────────────────────────────────────────────────

  function prevMonth() {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
    else setCurrentMonth(m => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
    else setCurrentMonth(m => m + 1);
  }

  // ── Derive CalendarTask[] from milestones + epics + issues ─────────────────

  const tasks: CalendarTask[] = [];

  milestones.forEach((milestone, mi) => {
    if (milestone.targetDate) {
      const startDate = milestone.createdAt.slice(0, 10);
      const color = T.columnAccents[mi % T.columnAccents.length];
      const issueCount = issues.filter(i => i.milestoneId === milestone.id).length;
      tasks.push({
        id: `milestone-${milestone.id}`,
        title: milestone.title,
        description: milestone.description || undefined,
        startDate,
        endDate: milestone.targetDate,
        assignees: [],
        color,
        type: 'milestone',
        milestoneId: milestone.id,
        issueCount,
      });
    }

    milestone.epics.forEach(epic => {
      if (!epic.startDate || !epic.endDate) return;
      const assignees = epic.assignees ?? [];
      const color = assigneeColors.get(assignees[0] ?? '') ?? T.columnAccents[mi % T.columnAccents.length];
      const issueCount = issues.filter(i => i.epicId === epic.id).length;
      tasks.push({
        id: `epic-${epic.id}`,
        title: epic.title,
        description: epic.description,
        startDate: epic.startDate,
        endDate: epic.endDate,
        assignees,
        color,
        type: 'epic',
        milestoneTitle: milestone.title,
        milestoneId: milestone.id,
        issueCount,
      });
    });
  });

  issues.forEach((issue, idx) => {
    const fallback = T.columnAccents[idx % T.columnAccents.length];
    const task = issueToCalendarTask(issue, assigneeColors, fallback);
    if (task) tasks.push(task);
  });

  // ── Click handlers ─────────────────────────────────────────────────────────

  function handleBarClick(task: CalendarTask, _e: React.MouseEvent) {
    if (task.type === 'issue') {
      const rawId = task.id.replace('issue-', '');
      const issue = issues.find(i => i.id === rawId);
      if (issue) setEditIssueTarget(issue);
      return;
    }
    const context: PopoverContext =
      task.type === 'milestone'
        ? { type: 'milestone', task }
        : { type: 'epic', task };
    setActionModalContext(context);
  }

  function handleCellClick(date: Date, _e: React.MouseEvent) {
    setActionModalContext({ type: 'cell', date });
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bgPage }}>
      {/* Header: nav + title + legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px',
        borderBottom: T.glassBorder,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={prevMonth}
            style={{ background: 'none', border: `1px solid ${T.borderMuted}`, color: T.textMuted, borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ color: T.textPrimary, fontSize: '15px', fontWeight: 600, minWidth: 160, textAlign: 'center' }}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <button
            onClick={nextMonth}
            style={{ background: 'none', border: `1px solid ${T.borderMuted}`, color: T.textMuted, borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ flex: 1 }} />

        <AssigneeLegend collaborators={collaborators} assigneeColors={assigneeColors} />
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 16px 16px' }}>
        <CalendarGrid
          tasks={tasks}
          year={currentYear}
          month={currentMonth}
          assigneeColors={assigneeColors}
          onBarClick={handleBarClick}
          onCellClick={handleCellClick}
        />
      </div>

      {/* Calendar Action Modal */}
      {actionModalContext && (
        <CalendarActionModal
          context={actionModalContext}
          projectSlug={projectSlug}
          milestones={milestones}
          sprints={sprints}
          onMutateBoard={() => void mutateBoard()}
          onMutateMilestones={() => void mutateMilestones()}
          onClose={() => setActionModalContext(null)}
        />
      )}

      {/* Edit Issue Modal */}
      {editIssueTarget && (
        <EditIssueModal
          projectSlug={projectSlug}
          issue={editIssueTarget}
          mutate={() => void mutateBoard()}
          onClose={() => setEditIssueTarget(null)}
        />
      )}


    </div>
  );
}
