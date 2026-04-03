import type { APIRoute } from 'astro';
import { getIronSession } from 'iron-session';
import { getSessionOptions, type SessionData } from '../../../auth/session';

export const prerender = false;

async function destroySessionAndRedirect(request: Request, redirect: (path: string) => Response, secret: string) {
  const response = redirect('/project-management');
  const session = await getIronSession<SessionData>(request, response, getSessionOptions(secret));
  session.destroy();
  await session.save();
  return response;
}

// @ts-ignore — import.meta.env fallback for local dev; locals.runtime.env used in Cloudflare
const getSecret = (locals: any): string => locals.runtime?.env?.SESSION_SECRET ?? import.meta.env.SESSION_SECRET ?? '';

export const GET: APIRoute = ({ request, redirect, locals }) => destroySessionAndRedirect(request, redirect, getSecret(locals));
export const POST: APIRoute = ({ request, redirect, locals }) => destroySessionAndRedirect(request, redirect, getSecret(locals));
