import React, { useState } from 'react';
import { T } from '../lib/theme';
import type { CalendarTask } from './CalendarGrid';
import { BAR_HEIGHT, ISSUE_BAR_HEIGHT, BAR_TOP_OFFSET, BAR_SLOT } from './CalendarGrid';
import TaskTooltip from './TaskTooltip';

// ── Internal helpers ────────────────────────────────────────────────────────

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayColIndex(d: Date): number {
  const dow = d.getDay();
  // Clamp weekends to 0 as a safety fallback (should not occur in practice)
  if (dow === 0 || dow === 6) return 0;
  return dow - 1; // Mon=0 … Fri=4
}

// ── Status dot colour ────────────────────────────────────────────────────────

function issueStatusColor(status: CalendarTask['issueStatus']): string {
  if (status === 'in-progress') return '#10b981';
  if (status === 'under-review') return '#f59e0b';
  if (status === 'done') return '#6b7280';
  return '#ef4444'; // not-started
}

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  task: CalendarTask;
  segmentStart: string;  // YYYY-MM-DD — clamped start within this week
  segmentEnd: string;    // YYYY-MM-DD — clamped end within this week
  lane: number;
  assigneeColors: Map<string, string>;
  onClick?: (task: CalendarTask, e: React.MouseEvent) => void;
}

// ── Tooltip state ───────────────────────────────────────────────────────────

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CalendarTaskBar({
  task,
  segmentStart,
  segmentEnd,
  lane,
  assigneeColors,
  onClick,
}: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0 });

  const startCol = dayColIndex(parseLocalDate(segmentStart));
  const endCol = dayColIndex(parseLocalDate(segmentEnd));
  const colSpan = endCol - startCol + 1;

  const left = `${startCol * 20}%`;
  const width = `${colSpan * 20}%`;
  const top = BAR_TOP_OFFSET + lane * BAR_SLOT;

  // Rounded corners only where the task actually starts/ends
  const leftR = segmentStart === task.startDate ? 4 : 0;
  const rightR = segmentEnd === task.endDate ? 4 : 0;

  const startsHere = segmentStart === task.startDate;

  const isIssue = task.type === 'issue';
  const barHeight = isIssue ? ISSUE_BAR_HEIGHT : BAR_HEIGHT;

  return (
    <>
      <div
        onMouseMove={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0 })}
        onClick={(e) => { e.stopPropagation(); onClick?.(task, e); }}
        style={{
          position: 'absolute',
          left,
          width,
          top,
          height: barHeight,
          background: task.color,
          opacity: isIssue ? 0.75 : 0.82,
          borderRadius: `${leftR}px ${rightR}px ${rightR}px ${leftR}px`,
          overflow: 'hidden',
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          padding: '0 6px',
          fontSize: 10,
          color: '#fff',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          fontFamily: T.fontPrimary,
          boxSizing: 'border-box',
          zIndex: 1,
        }}
      >
        {/* Issue: status dot */}
        {isIssue && task.issueStatus && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: issueStatusColor(task.issueStatus),
              flexShrink: 0,
              marginRight: 4,
              display: 'inline-block',
            }}
          />
        )}

        {/* Milestone/Epic: diamond marker at start */}
        {!isIssue && startsHere && (
          <span
            style={{
              fontSize: 8,
              color: '#fff',
              marginRight: 3,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ◆
          </span>
        )}

        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title}
        </span>
      </div>

      <TaskTooltip
        task={task}
        x={tooltip.x}
        y={tooltip.y}
        visible={tooltip.visible}
        assigneeColors={assigneeColors}
      />
    </>
  );
}
