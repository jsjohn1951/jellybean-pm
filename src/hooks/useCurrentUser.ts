import useSWR from 'swr';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

const fetcher = (url: string): Promise<GitHubUser | null> =>
  fetch(url).then(res => {
    if (res.status === 401) return null;
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json() as Promise<GitHubUser>;
  });

export function useCurrentUser() {
  const { data, error, isLoading } = useSWR<GitHubUser | null>(
    '/api/jellybean/auth/me',
    fetcher,
    { revalidateOnFocus: false }
  );
  return { user: data ?? null, isLoading: isLoading || data === undefined, error };
}
