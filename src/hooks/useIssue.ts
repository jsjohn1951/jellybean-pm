import useSWR from 'swr';
import { normaliseIssue, type Issue } from './useBoard';

const fetcher = (url: string) =>
  fetch(url)
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then((raw: Record<string, unknown>) => normaliseIssue(raw));

export function useIssue(projectSlug: string, issueId: string) {
  const { data, error, isLoading, mutate } = useSWR<Issue>(
    issueId ? `/api/jellybean/data/projects/${projectSlug}/issues/${issueId}` : null,
    fetcher,
    { dedupingInterval: 0 }
  );
  return { issue: data ?? null, error, isLoading, mutate };
}
