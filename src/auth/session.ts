import type { IronSession, SessionOptions } from 'iron-session';

export interface SessionData {
  githubToken?: string;
  githubRefreshToken?: string;
  githubTokenExpiresAt?: number; // Unix ms timestamp when the access token expires
  githubUser?: {
    login: string;
    name: string | null;
    avatar_url: string;
  };
}

export type AppSession = IronSession<SessionData>;

// Secret must be passed explicitly from route handlers via locals.runtime.env —
// import.meta.env user vars are not reliably inlined for workspace packages.
export function getSessionOptions(secret: string): SessionOptions {
  // @ts-ignore — import.meta.env.PROD is a Vite built-in, always replaced at build time
  const isProd: boolean = import.meta.env['PROD'] as boolean ?? false;
  return {
    cookieName: 'jellybean-pm-session',
    password: secret,
    cookieOptions: {
      httpOnly: true,
      secure: isProd,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    },
  };
}
