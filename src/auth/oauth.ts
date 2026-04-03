const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface GitHubTokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;               // seconds until access_token expires (GitHub Apps: 28800 = 8h)
  refresh_token_expires_in: number; // seconds until refresh_token expires (~6 months)
}

export function buildOAuthUrl(clientId: string, callbackUrl: string, state: string): string {
  // `scope: 'repo'` is required to read/write a PRIVATE repository.
  // Although the client ID belongs to a GitHub App, GitHub allows OAuth scopes to
  // be added to the authorization URL. Without this, the user access token only has
  // the GitHub App's installation permissions, which do not include private-repo
  // contents access unless the app was explicitly installed with contents:read on
  // the target repo. `repo` scope grants full read/write for all private repos the
  // user can access, which is what jellybean-pm needs.
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'repo',
    state,
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<GitHubTokenData> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; error?: string };
  if (data.error || !data.access_token) {
    throw new Error(`GitHub token exchange error: ${data.error ?? 'no access_token'}`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? '',
    expires_in: data.expires_in ?? 28800,
    refresh_token_expires_in: data.refresh_token_expires_in ?? 15897600,
  };
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<GitHubTokenData> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`GitHub token refresh failed: ${res.status}`);
  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; error?: string };
  if (data.error || !data.access_token) {
    throw new Error(`GitHub token refresh error: ${data.error ?? 'no access_token'}`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? '',
    expires_in: data.expires_in ?? 28800,
    refresh_token_expires_in: data.refresh_token_expires_in ?? 15897600,
  };
}

export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
