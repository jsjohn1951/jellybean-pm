import useSWR from 'swr';
import { apiFetch } from '../lib/fetcher';

export interface Doc {
  id: string;
  title: string;
  category: string;
  body: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function useDocs(projectSlug: string) {
  const { data, mutate } = useSWR<Doc[]>(
    projectSlug ? `/api/jellybean/data/projects/${projectSlug}/docs` : null,
    apiFetch<Doc[]>,
    { revalidateOnFocus: false }
  );
  return { docs: data ?? [], mutate };
}
