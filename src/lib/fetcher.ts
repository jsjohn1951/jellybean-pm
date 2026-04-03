/**
 * Shared API fetcher for SWR hooks.
 * On 401, redirects to logout — handles both missing sessions and expired GitHub tokens.
 */
export async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = '/api/jellybean/auth/logout';
    return [] as unknown as T; // navigation is pending — this value is never used
  }
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json() as Promise<T>;
}
