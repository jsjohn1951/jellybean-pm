import useSWR from 'swr';
import { apiFetch } from '../lib/fetcher';

export interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
}

export function useContributors() {
  const { data } = useSWR<Contributor[]>(
    '/api/jellybean/data/contributors',
    apiFetch<Contributor[]>,
    { revalidateOnFocus: false }
  );
  return { contributors: data ?? [] };
}
