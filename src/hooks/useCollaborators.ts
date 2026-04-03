import useSWR from 'swr';
import { apiFetch } from '../lib/fetcher';

export interface Collaborator { login: string; avatar_url: string; }

export function useCollaborators() {
  const { data } = useSWR<Collaborator[]>('/api/jellybean/data/collaborators', apiFetch<Collaborator[]>, {
    revalidateOnFocus: false,
  });
  return data ?? [];
}
