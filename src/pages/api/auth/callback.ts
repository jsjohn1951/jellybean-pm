import type { APIRoute } from 'astro';
import { getIronSession } from 'iron-session';
import { exchangeCodeForToken } from '../../../auth/oauth';
import { getSessionOptions, type SessionData } from '../../../auth/session';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('jellybean-pm-state')?.value;

  // CSRF check
  if (!code || !state || state !== storedState) {
    return new Response('Invalid OAuth state', { status: 400 });
  }

  cookies.delete('jellybean-pm-state', { path: '/' });

  try {
    // @ts-ignore — import.meta.env fallback for local dev; locals.runtime.env used in Cloudflare
    const clientId: string = (locals as any).runtime?.env?.KEYSTATIC_GITHUB_CLIENT_ID ?? import.meta.env.KEYSTATIC_GITHUB_CLIENT_ID ?? '';
    // @ts-ignore — import.meta.env fallback for local dev; locals.runtime.env used in Cloudflare
    const clientSecret: string = (locals as any).runtime?.env?.KEYSTATIC_GITHUB_CLIENT_SECRET ?? import.meta.env.KEYSTATIC_GITHUB_CLIENT_SECRET ?? '';
    const tokenData = await exchangeCodeForToken(clientId, clientSecret, code);
    const token = tokenData.access_token;

    // Fetch user info via GraphQL viewer query.
    // GET /user requires "Account: Profile information (read)" which this GitHub App lacks.
    // The GraphQL viewer fields are accessible with any user access token via the implicit
    // Metadata permission all GitHub Apps have.
    const userRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'cormonity-jellybean-pm/1.0',
      },
      body: JSON.stringify({ query: '{ viewer { login name avatarUrl } }' }),
    });
    if (!userRes.ok) {
      const body = await userRes.text().catch(() => '(unreadable)');
      throw new Error(`Failed to fetch GitHub viewer: ${userRes.status} ${body}`);
    }
    const { data } = await userRes.json() as {
      data?: { viewer: { login: string; name: string | null; avatarUrl: string } };
    };
    if (!data?.viewer?.login) throw new Error('GitHub GraphQL viewer returned no data');
    const user: SessionData['githubUser'] = {
      login: data.viewer.login,
      name: data.viewer.name ?? null,
      avatar_url: data.viewer.avatarUrl,
    };

    const response = redirect('/project-management');
    // @ts-ignore — import.meta.env fallback for local dev; locals.runtime.env used in Cloudflare
    const secret: string = (locals as any).runtime?.env?.KEYSTATIC_SECRET ?? import.meta.env.KEYSTATIC_SECRET ?? '';
    const session = await getIronSession<SessionData>(request, response, getSessionOptions(secret));
    session.githubToken = tokenData.access_token;
    session.githubRefreshToken = tokenData.refresh_token;
    session.githubTokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
    session.githubUser = user;
    await session.save();
    return response;
  } catch (err) {
    console.error('[jellybean-pm] OAuth callback error:', err);
    return new Response('Authentication failed', { status: 500 });
  }
};
