import type { APIRoute } from 'astro';
import { getIronSession } from 'iron-session';
import { getSessionOptions, type SessionData } from '../../../auth/session';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  // @ts-ignore — import.meta.env fallback for local dev; locals.runtime.env used in Cloudflare
  const secret: string = (locals as any).runtime?.env?.KEYSTATIC_SECRET ?? import.meta.env.KEYSTATIC_SECRET ?? '';
  // For read-only session access, pass a dummy Response (we don't write cookies here)
  const session = await getIronSession<SessionData>(request, new Response(), getSessionOptions(secret));
  if (!session.githubUser) {
    return new Response(null, { status: 401 });
  }
  return Response.json(session.githubUser);
};
