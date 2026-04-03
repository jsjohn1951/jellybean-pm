import React from 'react';
import { T } from '../lib/theme';
import type { CalendarTask } from './CalendarGrid';

// ── Internal helper ─────────────────────────────────────────────────────────

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShort(s: string): string {
  return parseLocalDate(s).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function issueStatusLabel(status: CalendarTask['issueStatus']): string {
  if (status === 'in-progress') return 'In Progress';
  if (status === 'under-review') return 'Under Review';
  if (status === 'done') return 'Done';
  return 'Not Started';
}

function issueStatusColor(status: CalendarTask['issueStatus']): string {
  if (status === 'in-progress') return '#10b981';
  if (status === 'under-review') return '#f59e0b';
  if (status === 'done') return '#6b7280';
  return '#ef4444';
}

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  task: CalendarTask;
  x: number;
  y: number;
  visible: boolean;
  assigneeColors: Map<string, string>;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function TaskTooltip({ task, x, y, visible, assigneeColors }: Props) {
  if (!visible) return null;

  const MAX_ASSIGNEES = 4;
  const shownAssignees = task.assignees.slice(0, MAX_ASSIGNEES);
  const hiddenCount = task.assignees.length - shownAssignees.length;

  return (
    <div
      style={{
        position: 'fixed',
        left: x + 14,
        top: y - 8,
        background: T.bgPanel,
        border: T.glassBorder,
        borderRadius: 8,
        padding: '12px 14px',
        boxShadow: T.glowShadow,
        zIndex: 9000,
        maxWidth: 280,
        pointerEvents: 'none',
        fontFamily: T.fontPrimary,
      }}
    >
      {/* Title */}
      <div
        style={{
          color: T.textPrimary,
          fontWeight: 700,
          fontSize: 13,
          marginBottom: 5,
          lineHeight: 1.3,
        }}
      >
        {task.title}
      </div>

      {/* Type badge for milestone/epic; status badge for issues */}
      <div style={{ marginBottom: task.milestoneTitle || task.description ? 6 : 0 }}>
        {task.type === 'issue' && task.issueStatus ? (
          <span
            style={{
              background: issueStatusColor(task.issueStatus) + '22',
              color: issueStatusColor(task.issueStatus),
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 99,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: `1px solid ${issueStatusColor(task.issueStatus)}44`,
            }}
          >
            {issueStatusLabel(task.issueStatus)}
          </span>
        ) : (
          <span
            style={{
              background: T.accentBg,
              color: T.accentText,
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 99,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {task.type === 'epic' ? 'Epic' : 'Milestone'}
          </span>
        )}
      </div>

      {/* Parent milestone (epics only) */}
      {task.type === 'epic' && task.milestoneTitle && (
        <div
          style={{
            color: T.textMuted,
            fontSize: 11,
            marginBottom: 5,
          }}
        >
          in Milestone: {task.milestoneTitle}
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div
          style={{
            color: T.textSecond,
            fontSize: 12,
            marginBottom: 7,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
          }}
        >
          {task.description}
        </div>
      )}

      {/* Date range — single date for same-day items */}
      <div
        style={{
          color: T.textMuted,
          fontSize: 11,
          fontFamily: T.fontMono,
          marginBottom: task.assignees.length > 0 || (task.issueCount ?? 0) > 0 ? 7 : 0,
        }}
      >
        {task.startDate === task.endDate
          ? formatShort(task.startDate)
          : `${formatShort(task.startDate)} → ${formatShort(task.endDate)}`}
      </div>

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            marginBottom: (task.issueCount ?? 0) > 0 ? 6 : 0,
          }}
        >
          {shownAssignees.map((login) => (
            <div
              key={login}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: assigneeColors.get(login) ?? T.textMuted,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: T.textSecond, fontSize: 11 }}>{login}</span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div style={{ color: T.textFaint, fontSize: 11, paddingLeft: 12 }}>
              +{hiddenCount} more
            </div>
          )}
        </div>
      )}

      {/* Issue count — hidden for issue type */}
      {task.type !== 'issue' && (task.issueCount ?? 0) > 0 && (
        <div style={{ color: T.textFaint, fontSize: 11 }}>
          {task.issueCount} linked issue{task.issueCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
