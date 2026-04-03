import useSWR from 'swr';
import { apiFetch } from '../lib/fetcher';

export interface MilestoneEpic {
  id: string;
  title: string;
  description?: string;  // free-text summary
  startDate?: string;    // YYYY-MM-DD — when epic work begins
  endDate?: string;      // YYYY-MM-DD — when epic is due
  assignees?: string[];  // GitHub logins assigned to this epic
  issueIds: string[];
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string | null;
  sprintId: string | null;
  status: 'planned' | 'in-progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  epics: MilestoneEpic[]; // optional grouping sections within a milestone
}

/** Normalise a raw GitHub-stored milestone to the current interface shape. */
export function normaliseMilestone(raw: Record<string, unknown>): Milestone {
  return {
    ...(raw as unknown as Milestone),
    epics: (raw.epics as MilestoneEpic[] | undefined) ?? [],
  };
}

export function useTimeline(projectSlug: string) {
  const { data, mutate } = useSWR<Milestone[]>(
    projectSlug ? `/api/jellybean/data/projects/${projectSlug}/timeline` : null,
    (url: string) => apiFetch<Record<string, unknown>[]>(url).then(
      (items) => items.map(normaliseMilestone)
    ),
    { revalidateOnFocus: false }
  );
  return { milestones: data ?? [], mutate };
}
