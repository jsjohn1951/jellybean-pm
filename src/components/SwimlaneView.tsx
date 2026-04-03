import React from 'react';
import {
  DndContext, type DragEndEvent,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core';
import type { Issue } from '../hooks/useBoard';
import type { useBoard } from '../hooks/useBoard';
import type { Collaborator } from '../hooks/useCollaborators';
import config from 'virtual:jellybean-pm/config';
import IssueDetailModal from './IssueDetailModal';
import { useToast } from '../lib/toast';
import { T } from '../lib/theme';

interface Props {
  issues: Issue[];
  collaborators: Collaborator[];
  projectSlug: string;
  mutate: ReturnType<typeof useBoard>['mutate'];
  selectedIssueId: string | null;
  onCardClick: (id: string) => void;
}

const PRIORITY_DOT: Record<string, string> = { critical: '#fca5a5', high: '#fca5a5', medium: '#fed7aa', low: '#86efac' };
const UNASSIGNED = '__unassigned__';

// Droppable table cell
function DroppableCell({ id, style, children }: { id: string; style: React.CSSProperties; children?: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <td ref={setNodeRef} style={{ ...style, background: isOver ? T.accentBg : style.background, transition: 'background 0.15s' }}>
      {children}
    </td>
  );
}

// Draggable mini card
function DraggableMiniCard({ issue, onCardClick }: { issue: Issue; onCardClick: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: issue.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onCardClick(issue.id)}
      style={{
        background: T.bgCard,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: '5px',
        padding: '7px 9px',
        marginBottom: '6px',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
        zIndex: isDragging ? 999 : undefined,
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT[issue.priority] ?? T.textFaint, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ color: T.textFaint, fontSize: '9px', fontFamily: 'monospace' }}>{issue.id}</span>
      </div>
      <p style={{ color: T.textPrimary, fontSize: '11px', margin: 0, lineHeight: 1.4 }}>{issue.title}</p>
    </div>
  );
}

export default function SwimlaneView({ issues, collaborators, projectSlug, mutate, selectedIssueId, onCardClick }: Props) {
  const { show } = useToast();
  const project = config.projects.find((p: { slug: string }) => p.slug === projectSlug);
  const columns: Array<{ id: string; name: string }> = project?.columns ?? [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const avatarMap = new Map(collaborators.map(c => [c.login, c.avatar_url]));
  function avatarUrl(login: string) {
    return avatarMap.get(login) ?? `https://github.com/${login}.png?size=32`;
  }

  const extraAssignees = [...new Set(
    issues.map(i => i.assignee).filter((a): a is string => !!a && !avatarMap.has(a))
  )];
  const rows: Array<{ login: string }> = [
    ...collaborators.map(c => ({ login: c.login })),
    ...extraAssignees.map(login => ({ login })),
  ];

  const unassigned = issues.filter(i => !i.assignee);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;

    const [newAssigneeRaw, newColumnId] = (over.id as string).split('::');
    const newAssignee = newAssigneeRaw === UNASSIGNED ? null : newAssigneeRaw;

    const assigneeChanged = newAssignee !== issue.assignee;
    const columnChanged = newColumnId !== issue.columnId;
    if (!assigneeChanged && !columnChanged) return;

    const now = new Date().toISOString();
    const previousIssues = issues;
    const optimistic = issues.map(i =>
      i.id === issueId ? { ...i, assignee: newAssignee, columnId: newColumnId } : i
    );
    await mutate(optimistic, { revalidate: false });

    try {
      const activity: Array<Record<string, string>> = [];
      if (assigneeChanged) activity.push({ type: 'assigned', by: 'me', at: now, to: newAssignee ?? '' });
      if (columnChanged) activity.push({ type: 'moved', by: 'me', at: now, from: issue.columnId, to: newColumnId });

      const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(assigneeChanged ? { assignee: newAssignee } : {}),
          ...(columnChanged ? { columnId: newColumnId } : {}),
          activity,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      await mutate();
    } catch {
      await mutate(previousIssues, { revalidate: false });
      show('Failed to update — please try again', 'error');
    }
  }

  const headerCell: React.CSSProperties = {
    padding: '8px 12px', color: T.textMuted, fontSize: '10px', fontWeight: 700,
    letterSpacing: '.08em', textTransform: 'uppercase', borderBottom: `1px solid ${T.borderSubtle}`,
    borderRight: `1px solid ${T.borderSubtle}`, background: T.bgCard,
  };
  const rowLabelCell: React.CSSProperties = {
    padding: '12px', borderBottom: `1px solid ${T.borderSubtle}`, borderRight: `1px solid ${T.borderSubtle}`,
    verticalAlign: 'top', background: T.bgPage, overflow: 'hidden',
  };
  const dataCell: React.CSSProperties = {
    padding: '10px', borderBottom: `1px solid ${T.borderSubtle}`, borderRight: `1px solid ${T.borderSubtle}`,
    verticalAlign: 'top', background: T.bgDropZone,
  };

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={headerCell}>Assignee</th>
                {columns.map(col => (
                  <th key={col.id} style={headerCell}>{col.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const rowIssues = issues.filter(i => i.assignee === row.login);
                return (
                  <tr key={row.login}>
                    <td style={rowLabelCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={avatarUrl(row.login)} alt={row.login}
                          style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        <span style={{ color: T.textSecond, fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.login}</span>
                      </div>
                      <div style={{ marginTop: '4px', color: T.borderMuted, fontSize: '10px' }}>
                        {rowIssues.length} issue{rowIssues.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    {columns.map(col => (
                      <DroppableCell key={col.id} id={`${row.login}::${col.id}`} style={dataCell}>
                        {rowIssues.filter(i => i.columnId === col.id).map(i =>
                          <DraggableMiniCard key={i.id} issue={i} onCardClick={onCardClick} />
                        )}
                      </DroppableCell>
                    ))}
                  </tr>
                );
              })}
              {/* Unassigned row — always shown */}
              <tr>
                <td style={rowLabelCell}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: T.textFaint, fontSize: '11px' }}>?</span>
                    </div>
                    <span style={{ color: T.textMuted, fontSize: '12px', fontStyle: 'italic' }}>Unassigned</span>
                  </div>
                  <div style={{ marginTop: '4px', color: T.borderMuted, fontSize: '10px' }}>
                    {unassigned.length} issue{unassigned.length !== 1 ? 's' : ''}
                  </div>
                </td>
                {columns.map(col => (
                  <DroppableCell key={col.id} id={`${UNASSIGNED}::${col.id}`} style={dataCell}>
                    {unassigned.filter(i => i.columnId === col.id).map(i =>
                      <DraggableMiniCard key={i.id} issue={i} onCardClick={onCardClick} />
                    )}
                  </DroppableCell>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </DndContext>
      {selectedIssueId && (
        <IssueDetailModal issueId={selectedIssueId} projectSlug={projectSlug} onClose={() => onCardClick('')} mutate={mutate} />
      )}
    </>
  );
}
