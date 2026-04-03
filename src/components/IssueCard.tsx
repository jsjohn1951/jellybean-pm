import React, { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Issue } from '../hooks/useBoard';
import { T } from '../lib/theme';

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: '#450a0a', text: '#fca5a5', dot: '#ef4444' },
  high:     { bg: '#7f1d1d', text: '#fca5a5', dot: '#f87171' },
  medium:   { bg: '#431407', text: '#fed7aa', dot: '#fb923c' },
  low:      { bg: '#1a2e1a', text: '#86efac', dot: '#4ade80' },
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

interface Props {
  issue: Issue;
  /** Up to 4 avatar URLs for the multi-assignee display */
  avatarUrls?: string[];
  onClick: () => void;
}

export default function IssueCard({ issue, avatarUrls = [], onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  const pc = PRIORITY_COLORS[issue.priority] ?? PRIORITY_COLORS.medium;

  // Live tick for in-progress timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!issue.timerStartedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [issue.timerStartedAt]);

  const elapsedMs = (issue.timerAccumulatedMs ?? 0) +
    (issue.timerStartedAt ? now - new Date(issue.timerStartedAt).getTime() : 0);
  const deadlineMs = issue.deadline
    ? ((issue.deadline.days * 24) + issue.deadline.hours) * 3_600_000
    : null;
  const timerPct = deadlineMs ? Math.min(elapsedMs / deadlineMs, 1) : null;
  const showTimer = elapsedMs > 0 || issue.timerStartedAt !== null;

  const timerColor = timerPct === null
    ? T.accentCyan
    : timerPct > 1 ? T.dangerText : timerPct > 0.8 ? T.accentAmber : T.accentCyan;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: T.bgCard,
        backdropFilter: T.glassBlur,
        WebkitBackdropFilter: T.glassBlur,
        border: T.glassBorder,
        borderRadius: '8px',
        padding: '10px 11px',
        marginBottom: '6px',
        cursor: 'grab',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        overflow: 'hidden',
      }}
      {...attributes}
      {...listeners}
    >
      {/* Priority indicator + title */}
      <div style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', marginBottom: '8px' }}>
        <span style={{
          width: 3,
          alignSelf: 'stretch',
          borderRadius: '2px',
          background: pc.dot,
          flexShrink: 0,
          marginTop: '1px',
        }} />
        <span
          onClick={onClick}
          style={{ color: T.textPrimary, fontSize: '12px', fontWeight: 500, lineHeight: 1.45, cursor: 'pointer', flex: 1 }}
        >
          {issue.title}
        </span>
      </div>

      {/* Footer: labels + issue ID + assignee avatars */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          background: pc.bg,
          color: pc.text,
          fontSize: '9px',
          fontWeight: 600,
          padding: '1px 5px',
          borderRadius: '3px',
          textTransform: 'capitalize',
          fontFamily: T.fontMono,
        }}>
          {issue.priority}
        </span>
        {issue.labels.slice(0, 2).map(l => (
          <span key={l} style={{ background: T.accentBg, color: T.accentText, fontSize: '9px', padding: '1px 5px', borderRadius: '3px' }}>{l}</span>
        ))}
        <span style={{ color: T.textFaint, fontSize: '10px', fontFamily: T.fontMono, marginLeft: 'auto' }}>{issue.id}</span>
        {/* Multi-assignee avatars (up to 4, stacked) */}
        <div style={{ display: 'flex', flexDirection: 'row-reverse', marginLeft: '2px' }}>
          {avatarUrls.length === 0 ? (
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: T.bgInput, flexShrink: 0, border: `1.5px solid ${T.borderMuted}` }} />
          ) : (
            avatarUrls.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt=""
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                  border: `1.5px solid ${T.bgCard}`,
                  marginLeft: idx < avatarUrls.length - 1 ? '-6px' : 0,
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Timer bar — only shown when timer has elapsed */}
      {showTimer && (
        <div style={{ marginTop: '8px' }}>
          <div style={{
            height: '3px',
            borderRadius: '2px',
            background: T.bgInput,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: timerPct !== null ? `${timerPct * 100}%` : '100%',
              background: timerColor,
              borderRadius: '2px',
              transition: 'width 1s linear',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
            <span style={{ color: timerColor, fontSize: '9px', fontFamily: T.fontMono }}>
              {formatElapsed(elapsedMs)} elapsed
            </span>
            {issue.deadline && (
              <span style={{ color: T.textFaint, fontSize: '9px', fontFamily: T.fontMono }}>
                / {issue.deadline.days}d {issue.deadline.hours}h
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
