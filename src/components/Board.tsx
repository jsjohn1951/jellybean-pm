import React from 'react';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import Column from './Column';
import IssueDetailModal from './IssueDetailModal';
import { useBoard, type Issue } from '../hooks/useBoard';
import type { Collaborator } from '../hooks/useCollaborators';
import config from 'virtual:jellybean-pm/config';
import { useToast } from '../lib/toast';
import { useMutation } from '../lib/mutation-context';

interface Props {
  issues: Issue[];
  collaborators: Collaborator[];
  projectSlug: string;
  mutate: ReturnType<typeof useBoard>['mutate'];
  onCardClick: (id: string) => void;
  selectedIssueId: string | null;
  /** On mobile, only render this column (null = render all) */
  visibleColumnId?: string | null;
}

/** Determine whether a column ID represents the "In Progress" state. */
function isInProgress(columnId: string) {
  return columnId === 'in-progress' || columnId.toLowerCase().includes('progress');
}

/** Build timer-related PATCH fields when a drag moves an issue into or out of In Progress. */
function timerPatch(issue: Issue, newColumnId: string): Record<string, unknown> {
  const wasInProgress = isInProgress(issue.columnId);
  const nowInProgress = isInProgress(newColumnId);
  if (!wasInProgress && nowInProgress) {
    // Drag TO in-progress: start timer
    return { timerStartedAt: new Date().toISOString() };
  }
  if (wasInProgress && !nowInProgress) {
    // Drag AWAY from in-progress: accumulate elapsed time and stop
    const elapsed = issue.timerStartedAt
      ? Date.now() - new Date(issue.timerStartedAt).getTime()
      : 0;
    return {
      timerStartedAt: null,
      timerAccumulatedMs: (issue.timerAccumulatedMs ?? 0) + elapsed,
    };
  }
  return {};
}

export default function Board({ issues, collaborators, projectSlug, mutate, onCardClick, selectedIssueId, visibleColumnId }: Props) {
  const { show } = useToast();
  const { withMutation } = useMutation();
  const project = config.projects.find((p: { slug: string }) => p.slug === projectSlug);
  const allColumns = project?.columns ?? [];
  const columns = visibleColumnId
    ? allColumns.filter((c: { id: string }) => c.id === visibleColumnId)
    : allColumns;

  const avatarMap = new Map(collaborators.map(c => [c.login, c.avatar_url]));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overId = over.id as string;
    const newColumnId = allColumns.some((c: { id: string }) => c.id === overId)
      ? overId
      : (issues.find(i => i.id === overId)?.columnId ?? overId);

    const issueId = active.id as string;
    const issue = issues.find(i => i.id === issueId);
    if (!issue || issue.columnId === newColumnId) return;

    const now = new Date().toISOString();
    const timer = timerPatch(issue, newColumnId);
    const previousIssues = issues;
    const optimistic = issues.map(i =>
      i.id === issueId ? { ...i, columnId: newColumnId, ...timer } : i
    );

    await withMutation(async () => {
      await mutate(optimistic, { revalidate: false });
      try {
        const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/issues/${issueId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            columnId: newColumnId,
            ...timer,
            activity: [{ type: 'moved', by: 'me', from: issue.columnId, to: newColumnId, at: now }],
          }),
        });
        if (!res.ok) throw new Error('save failed');
        await mutate();
      } catch {
        await mutate(previousIssues, { revalidate: false });
        show('Failed to save — please try again', 'error');
      }
    });
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', width: '100%' }}>
          {columns.map((col: { id: string; name: string }, idx: number) => (
            <Column
              key={col.id}
              column={col}
              colIndex={allColumns.findIndex((c: { id: string }) => c.id === col.id)}
              issues={issues.filter(i => i.columnId === col.id)}
              onCardClick={onCardClick}
              avatarMap={avatarMap}
            />
          ))}
        </div>
      </DndContext>
      {selectedIssueId && (
        <IssueDetailModal issueId={selectedIssueId} projectSlug={projectSlug} onClose={() => onCardClick('')} mutate={mutate} />
      )}
    </>
  );
}
