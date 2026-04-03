import useSWR from 'swr';
import { apiFetch } from '../lib/fetcher';

export interface IssueActivity {
  type: string;
  by: string;
  at: string;
  from?: string;
  to?: string;
  text?: string;
}

export interface IssueAttachment {
  name: string;
  path: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface IssueDeadline {
  days: number;
  hours: number;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  columnId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee: string | null;        // legacy field — kept for backward compat
  assignees: string[];            // authoritative multi-assignee list
  labels: string[];
  sprintId: string | null;
  attachments: IssueAttachment[];
  activity: IssueActivity[];
  createdAt: string;
  updatedAt: string;
  // Timer fields
  timerStartedAt: string | null;  // ISO timestamp set when dragged to In Progress
  timerAccumulatedMs: number;     // ms of paused time accumulated across sessions
  deadline: IssueDeadline | null;
  // Milestone linkage
  milestoneId: string | null;
  epicId: string | null;          // id of epic within the milestone
}

/** Normalise a raw GitHub-stored issue to the current interface shape. */
export function normaliseIssue(raw: Record<string, unknown>): Issue {
  return {
    ...(raw as unknown as Issue),
    assignees: (raw.assignees as string[] | undefined) ??
      (raw.assignee ? [raw.assignee as string] : []),
    timerStartedAt: (raw.timerStartedAt as string | null) ?? null,
    timerAccumulatedMs: (raw.timerAccumulatedMs as number | undefined) ?? 0,
    deadline: (raw.deadline as IssueDeadline | null) ?? null,
    milestoneId: (raw.milestoneId as string | null) ?? null,
    epicId: (raw.epicId as string | null) ?? null,
  };
}

export function useBoard(projectSlug: string) {
  const { data, error, isLoading, mutate } = useSWR<Issue[]>(
    projectSlug ? `/api/jellybean/data/projects/${projectSlug}/issues` : null,
    (url: string) => apiFetch<Record<string, unknown>[]>(url).then(
      (items) => items.map(normaliseIssue)
    )
  );
  return {
    issues: data ?? [],
    error,
    isLoading,
    mutate,
  };
}
