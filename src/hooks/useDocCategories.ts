import useSWR from 'swr';
import { apiFetch } from '../lib/fetcher';

export function useDocCategories(projectSlug: string) {
  const { data, mutate } = useSWR<string[]>(
    projectSlug ? `/api/jellybean/data/projects/${projectSlug}/doc-categories` : null,
    apiFetch<string[]>,
    { revalidateOnFocus: false }
  );
  return { categories: data ?? [], mutate };
}
