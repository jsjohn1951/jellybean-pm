import useSWR from 'swr';
import { apiFetch } from '../lib/fetcher';

export interface Sprint {
  id: string;
  name: string;
  status: 'planned' | 'active' | 'completed';
  createdAt: string;
}

export function useSprints(projectSlug: string) {
  const { data, mutate } = useSWR<Sprint[]>(
    projectSlug ? `/api/jellybean/data/projects/${projectSlug}/sprints` : null,
    apiFetch<Sprint[]>,
    { revalidateOnFocus: false }
  );
  return { sprints: data ?? [], mutate };
}
