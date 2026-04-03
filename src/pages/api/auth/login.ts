import type { APIRoute } from 'astro';
import { buildOAuthUrl, generateState } from '../../../auth/oauth';

export const prerender = false;

export const GET: APIRoute = ({ request, cookies, redirect, locals }) => {
  const state = generateState();
  const origin = new URL(request.url).origin;
  const callbackUrl = `${origin}/api/jellybean/auth/callback`;

  cookies.set('jellybean-pm-state', state, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
    // @ts-ignore — import.meta.env is provided by Astro's build environment
    secure: import.meta.env.PROD,
    sameSite: 'lax',
  });

  // @ts-ignore — import.meta.env fallback for local dev; locals.runtime.env used in Cloudflare
  const clientId: string = (locals as any).runtime?.env?.GITHUB_CLIENT_ID ?? import.meta.env.GITHUB_CLIENT_ID ?? '';
  return redirect(buildOAuthUrl(clientId, callbackUrl, state));
};
