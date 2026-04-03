import type { APIContext, APIRoute } from 'astro';
import { getIronSession } from 'iron-session';
import config from 'virtual:jellybean-pm/config';
import { refreshAccessToken } from '../../auth/oauth';
import { getSessionOptions, type SessionData } from '../../auth/session';
import { GitHubStorage } from '../../github/storage';
import { formatIssueId } from '../../lib/issue-id';
import type { ProjectConfig, StorageConfig } from '../../config/schema';

export const prerender = false;

/** Converts GitHub client 401/403 errors into proper 401 HTTP responses. */
function withGitHubErrors(handler: APIRoute): APIRoute {
  return async (ctx) => {
    try {
      return await handler(ctx);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err) {
        const status = (err as { status: number }).status;
        if (status === 401 || status === 403) return new Response(null, { status: 401 });
      }
      throw err;
    }
  };
}

function storageForProject(token: string, slug: string): GitHubStorage {
  const project = config.projects.find((p: ProjectConfig) => p.slug === slug);
  const storage = (project?._resolvedStorage ?? config.storage) as StorageConfig | undefined;
  if (!storage) throw new Error(`[jellybean-pm] No storage config for project "${slug}"`);
  return new GitHubStorage(token, storage);
}

function globalStorage(token: string): GitHubStorage {
  const storage = (config.storage ?? config.projects[0]?._resolvedStorage) as StorageConfig | undefined;
  if (!storage) throw new Error('[jellybean-pm] No global storage config available');
  return new GitHubStorage(token, storage);
}

type AuthResult = { token: string; userLogin: string; setCookie: string | null };

async function requireAuth(request: Request, locals: unknown): Promise<AuthResult | Response> {
  // @ts-ignore — import.meta.env fallback for local dev; locals.runtime.env used in Cloudflare
  const secret: string = (locals as any)?.runtime?.env?.KEYSTATIC_SECRET ?? import.meta.env.KEYSTATIC_SECRET ?? '';
  const hasRuntime = !!(locals as any)?.runtime?.env;
  const sessionRes = new Response();
  const session = await getIronSession<SessionData>(request, sessionRes, getSessionOptions(secret));
  const token = session.githubToken;
  console.log('[jellybean-pm] auth check: token present =', !!token, '| token prefix =', token?.slice(0, 4) ?? 'none', '| runtime env present =', hasRuntime, '| secret length =', secret.length);
  if (!token) return new Response(null, { status: 401 });

  // Refresh the access token if it is within 5 minutes of expiry
  const expiresAt = session.githubTokenExpiresAt;
  const nearExpiry = expiresAt !== undefined && expiresAt - Date.now() < 5 * 60 * 1000;
  if (nearExpiry && session.githubRefreshToken) {
    try {
      // @ts-ignore — two-tier env lookup
      const clientId: string = (locals as any)?.runtime?.env?.KEYSTATIC_GITHUB_CLIENT_ID ?? import.meta.env.KEYSTATIC_GITHUB_CLIENT_ID ?? '';
      // @ts-ignore — two-tier env lookup
      const clientSecret: string = (locals as any)?.runtime?.env?.KEYSTATIC_GITHUB_CLIENT_SECRET ?? import.meta.env.KEYSTATIC_GITHUB_CLIENT_SECRET ?? '';
      const tokenData = await refreshAccessToken(clientId, clientSecret, session.githubRefreshToken);
      session.githubToken = tokenData.access_token;
      session.githubRefreshToken = tokenData.refresh_token;
      session.githubTokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
      await session.save();
    } catch (err) {
      console.warn('[jellybean-pm] Token refresh failed, using existing token:', err);
    }
  }

  return {
    token: session.githubToken ?? token,
    userLogin: session.githubUser?.login ?? 'unknown',
    setCookie: sessionRes.headers.get('Set-Cookie'),
  };
}

/** Higher-order route wrapper: handles auth, token refresh, and cookie propagation. */
function withAuth(handler: (ctx: APIContext, token: string, userLogin: string) => Promise<Response>): APIRoute {
  return withGitHubErrors(async (ctx) => {
    const auth = await requireAuth(ctx.request, ctx.locals);
    if (auth instanceof Response) return auth;
    const response = await handler(ctx, auth.token, auth.userLogin);
    if (!auth.setCookie) return response;
    // Propagate the refreshed session cookie onto the response
    const headers = new Headers(response.headers);
    headers.append('Set-Cookie', auth.setCookie);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  });
}

function padPage(n: number): string { return String(n).padStart(3, '0'); }

async function appendMessage(
  storage: GitHubStorage,
  convKey: string,
  body: Record<string, unknown>,
  userLogin: string
): Promise<Record<string, unknown>> {
  const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Handle binary upload if present
  const binaryUpload = body['_binaryUpload'] as { path: string; content: string } | undefined;
  if (binaryUpload) {
    await storage.writeBinary(binaryUpload.path, binaryUpload.content, undefined, `feat: add attachment to chat`);
    delete body['_binaryUpload'];
  }

  // Build message object
  const msg = {
    id: msgId,
    authorLogin: userLogin,
    text: (body['text'] as string | undefined) ?? '',
    attachments: (body['attachments'] as unknown[]) ?? [],
    createdAt: new Date().toISOString(),
  };

  // Detect convKey type: 'group' | 'dms/{convId}' | 'projects/{slug}/group'
  const isProjectGroup = convKey.startsWith('projects/') && convKey.endsWith('/group');
  const projectGroupSlug = isProjectGroup ? convKey.split('/')[1] : undefined;
  const isDm = convKey.startsWith('dms/');
  const dmKey = isDm ? convKey.slice('dms/'.length) : undefined;

  // Read current meta to determine target page
  type MetaShape = {
    group: { pageCount: number; latestMsgId?: string };
    dms: { [k: string]: { pageCount: number; latestMsgId?: string } };
    projects?: { [slug: string]: { group: { pageCount: number; latestMsgId?: string } } };
  };
  const meta = await storage.readJSON<MetaShape>('chat/meta.json');
  const count = convKey === 'group'
    ? (meta?.data?.group?.pageCount ?? 0)
    : isProjectGroup
      ? (meta?.data?.projects?.[projectGroupSlug!]?.group?.pageCount ?? 0)
      : (meta?.data?.dms?.[dmKey!]?.pageCount ?? 0);
  const pageIndex = Math.max(0, count - 1);

  // Try appending to the current page with optimistic concurrency retry
  type Page = { messages: unknown[]; full: boolean };
  const pageFilePath = `chat/${convKey}/messages-${padPage(pageIndex)}.json`;

  const result = await storage.writeJSONWithRetry<Page>(
    pageFilePath,
    (current) => {
      if (!current) return { messages: [msg], full: false };
      if (current.full) return current; // signal: page is full, don't modify
      return {
        messages: [...current.messages, msg],
        full: (current.messages.length + 1) >= 50,
      };
    },
    `chat: message in ${convKey}`,
  );

  // If the page was already full (updater returned it unchanged), write to the next page and update meta
  const pageWasFull = result.data.messages[result.data.messages.length - 1] !== msg
    && !result.data.messages.some((m: unknown) => (m as { id: string }).id === msgId);

  if (pageWasFull) {
    const newPageIndex = count; // count is already the next index since pages are 0-based
    const newPageFilePath = `chat/${convKey}/messages-${padPage(newPageIndex)}.json`;

    await storage.writeJSONWithRetry<Page>(
      newPageFilePath,
      (current) => {
        if (current && current.messages.some((m: unknown) => (m as { id: string }).id === msgId)) {
          return current; // already written (retry scenario)
        }
        const existing = current?.messages ?? [];
        return {
          messages: [...existing, msg],
          full: (existing.length + 1) >= 50,
        };
      },
      `chat: message in ${convKey}`,
    );
  }

  // Always update meta: initialize entry on first message, track latestMsgId for unread detection
  const metaPageCount = pageWasFull ? count + 1 : Math.max(count, 1);
  await storage.writeJSONWithRetry<MetaShape>(
    'chat/meta.json',
    (currentMeta) => {
      const base = currentMeta ?? { group: { pageCount: 0 }, dms: {} };
      if (convKey === 'group') {
        return { ...base, group: { pageCount: Math.max(base.group?.pageCount ?? 0, metaPageCount), latestMsgId: msgId } };
      }
      if (isProjectGroup) {
        const prevGroup = base.projects?.[projectGroupSlug!]?.group;
        return {
          ...base,
          projects: {
            ...base.projects,
            [projectGroupSlug!]: { group: { pageCount: Math.max(prevGroup?.pageCount ?? 0, metaPageCount), latestMsgId: msgId } },
          },
        };
      }
      return {
        ...base,
        dms: { ...base.dms, [dmKey!]: { pageCount: Math.max(base.dms[dmKey!]?.pageCount ?? 0, metaPageCount), latestMsgId: msgId } },
      };
    },
    `chat: update meta for ${convKey}`,
  );

  return msg;
}

export const GET: APIRoute = withAuth(async ({ params, request }, token, userLogin) => {
  const path = (params['path'] as string | undefined) ?? '';
  const parts = path.split('/').filter(Boolean);
  const storage = parts[0] === 'projects' ? storageForProject(token, parts[1]) : globalStorage(token);

  // GET /collaborators — list repo collaborators
  if (parts.length === 1 && parts[0] === 'collaborators') {
    try {
      const collaborators = await storage.listCollaborators();
      return Response.json(collaborators);
    } catch (err) {
      console.error('[jellybean-pm] GET collaborators failed:', String(err));
      return Response.json([]);
    }
  }

  // GET /contributors — list repo contributors
  if (parts.length === 1 && parts[0] === 'contributors') {
    try {
      const contributors = await storage.listContributors();
      return Response.json(contributors);
    } catch (err) {
      console.error('[jellybean-pm] GET contributors failed:', String(err));
      return Response.json([]);
    }
  }

  // GET /files/{path} — serve binary attachment content
  if (parts[0] === 'files' && parts.length > 1) {
    const filePath = parts.slice(1).join('/');
    const file = await storage.readBinary(filePath);
    if (!file) return new Response(null, { status: 404 });

    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const MIME: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      pdf: 'application/pdf', txt: 'text/plain',
    };
    const contentType = MIME[ext] ?? 'application/octet-stream';
    const binary = Uint8Array.from(atob(file.content), c => c.charCodeAt(0));
    return new Response(binary, {
      headers: { 'Content-Type': contentType, 'Content-Disposition': 'inline' },
    });
  }

  // GET /projects — list all projects from config
  if (parts.length === 0 || (parts.length === 1 && parts[0] === 'projects')) {
    return Response.json(config.projects.map((p: ProjectConfig) => ({
      slug: p.slug,
      name: p.name,
      columns: p.columns,
    })));
  }

  // GET /projects/{slug}/timeline
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'timeline') {
    const slug = parts[1];
    try {
      const result = await storage.readJSON<Array<Record<string, unknown>>>(`projects/${slug}/timeline.json`);
      return Response.json(result?.data ?? []);
    } catch (err) {
      console.error(`[jellybean-pm] GET timeline failed for ${slug}:`, String(err));
      return Response.json([]);
    }
  }

  // GET /projects/{slug}/doc-categories
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'doc-categories') {
    const slug = parts[1];
    try {
      const result = await storage.readJSON<string[]>(`projects/${slug}/doc-categories.json`);
      return Response.json(result?.data ?? []);
    } catch (err) {
      console.error(`[jellybean-pm] GET doc-categories failed for ${slug}:`, String(err));
      return Response.json([]);
    }
  }

  // GET /projects/{slug}/docs — list all docs
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'docs') {
    const slug = parts[1];
    try {
      const ids = await storage.listDocIds(slug);
      if (ids.length === 0) return Response.json([]);
      const docResults = await Promise.all(
        ids.map(id => storage.readJSON<Record<string, unknown>>(`projects/${slug}/docs/${id}.json`))
      );
      return Response.json(docResults.filter(Boolean).map(r => r!.data));
    } catch (err) {
      console.error(`[jellybean-pm] GET docs failed for ${slug}:`, String(err));
      return Response.json([]);
    }
  }

  // GET /projects/{slug}/sprints
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'sprints') {
    const slug = parts[1];
    try {
      const result = await storage.readJSON<Array<Record<string, unknown>>>(`projects/${slug}/sprints.json`);
      return Response.json(result?.data ?? []);
    } catch (err) {
      console.error(`[jellybean-pm] GET sprints failed for ${slug}:`, String(err));
      return Response.json([]);
    }
  }

  // GET /projects/{slug}/issues — list all issues
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'issues') {
    const slug = parts[1];
    try {
      const ids = await storage.listIssueIds(slug);
      if (ids.length === 0) return Response.json([]);
      const issueResults = await Promise.all(
        ids.map(id => storage.readJSON<Record<string, unknown>>(`projects/${slug}/issues/${id}.json`))
      );
      return Response.json(issueResults.filter(Boolean).map(r => r!.data));
    } catch (err) {
      console.error(`[jellybean-pm] GET issues failed for ${slug}:`, String(err));
      return Response.json([]);
    }
  }

  // GET /projects/{slug}/issues/{id} — single issue
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'issues') {
    const [, slug, , issueId] = parts;
    const result = await storage.readJSON(`projects/${slug}/issues/${issueId}.json`);
    if (!result) return new Response(null, { status: 404 });
    return Response.json(result.data);
  }

  // GET /chat/meta
  if (parts[0] === 'chat' && parts[1] === 'meta' && parts.length === 2) {
    const result = await storage.readJSON('chat/meta.json');
    return Response.json(result?.data ?? { group: { pageCount: 0 }, dms: {} });
  }

  // GET /chat/group/messages?page=N
  if (parts[0] === 'chat' && parts[1] === 'group' && parts[2] === 'messages' && parts.length === 3) {
    const pageNum = parseInt(new URL(request.url).searchParams.get('page') ?? '0', 10);
    const result = await storage.readJSON(`chat/group/messages-${padPage(pageNum)}.json`);
    return Response.json(result?.data ?? { messages: [], full: false });
  }

  // GET /projects/{slug}/chat/group/messages?page=N
  if (parts[0] === 'projects' && parts[2] === 'chat' && parts[3] === 'group' && parts[4] === 'messages' && parts.length === 5) {
    const slug = parts[1];
    const pageNum = parseInt(new URL(request.url).searchParams.get('page') ?? '0', 10);
    const result = await storage.readJSON(`chat/projects/${slug}/group/messages-${padPage(pageNum)}.json`);
    return Response.json(result?.data ?? { messages: [], full: false });
  }

  // GET /chat/dm/{convId}/messages?page=N
  if (parts[0] === 'chat' && parts[1] === 'dm' && parts[2] && parts[2] !== 'messages' && parts[3] === 'messages' && parts.length === 4) {
    const convId = parts[2];
    if (!convId.split('_').includes(userLogin)) return new Response(null, { status: 403 });
    const pageNum = parseInt(new URL(request.url).searchParams.get('page') ?? '0', 10);
    const result = await storage.readJSON(`chat/dms/${convId}/messages-${padPage(pageNum)}.json`);
    return Response.json(result?.data ?? { messages: [], full: false });
  }

  // GET /chat/user-state/{login} — read another user's state (for seen indicators)
  if (parts[0] === 'chat' && parts[1] === 'user-state' && parts[2] && parts.length === 3) {
    const result = await storage.readJSON(`user-state/${parts[2]}.json`);
    return Response.json(result?.data ?? { openDms: [], lastRead: {} });
  }

  // GET /chat/user-state
  if (parts[0] === 'chat' && parts[1] === 'user-state' && parts.length === 2) {
    const result = await storage.readJSON(`user-state/${userLogin}.json`);
    return Response.json(result?.data ?? { openDms: [], lastRead: {} });
  }

  // GET /projects/{slug}/assets
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'assets') {
    const slug = parts[1];
    const result = await storage.readJSON<unknown[]>(`projects/${slug}/assets.json`);
    return Response.json(result?.data ?? []);
  }

  return new Response(null, { status: 404 });
});

export const POST: APIRoute = withAuth(async ({ request, params }, token, userLogin) => {
  const path = (params['path'] as string | undefined) ?? '';
  const parts = path.split('/').filter(Boolean);
  const storage = parts[0] === 'projects' ? storageForProject(token, parts[1]) : globalStorage(token);

  // POST /projects/{slug}/timeline — create milestone
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'timeline') {
    const slug = parts[1];
    const body = await request.json() as Record<string, unknown>;
    if (!body['title'] || typeof body['title'] !== 'string' || !body['title'].trim()) {
      return new Response(JSON.stringify({ error: 'title is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const now = new Date().toISOString();
    const milestone = {
      id: `milestone-${Date.now()}`,
      title: (body['title'] as string).trim(),
      description: (body['description'] as string | undefined) ?? '',
      targetDate: (body['targetDate'] as string | undefined) ?? null,
      sprintId: (body['sprintId'] as string | undefined) ?? null,
      status: (body['status'] as string | undefined) ?? 'planned',
      createdAt: now,
      updatedAt: now,
    };
    const result = await storage.readJSON<Array<Record<string, unknown>>>(`projects/${slug}/timeline.json`);
    const existing = result?.data ?? [];
    await storage.writeJSON(`projects/${slug}/timeline.json`, [...existing, milestone], result?.sha, `feat: create milestone "${milestone.title}"`);
    return Response.json(milestone, { status: 201 });
  }

  // POST /projects/{slug}/docs — create doc
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'docs') {
    const slug = parts[1];
    const body = await request.json() as Record<string, unknown>;
    if (!body['title'] || typeof body['title'] !== 'string' || !body['title'].trim()) {
      return new Response(JSON.stringify({ error: 'title is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const now = new Date().toISOString();
    const id = `doc-${Date.now()}`;

    const binaryUpload = body['_binaryUpload'] as { path: string; content: string } | undefined;
    if (binaryUpload) {
      await storage.writeBinary(binaryUpload.path, binaryUpload.content, undefined, `feat: add attachment to ${id}`);
      delete (body as Record<string, unknown>)['_binaryUpload'];
    }

    const doc = {
      id,
      title: (body['title'] as string).trim(),
      category: (body['category'] as string | undefined) ?? '',
      body: (body['body'] as string | undefined) ?? '',
      attachmentPath: binaryUpload?.path ?? null,
      attachmentName: (body['attachmentName'] as string | undefined) ?? null,
      createdBy: (body['createdBy'] as string | undefined) ?? userLogin,
      createdAt: now,
      updatedAt: now,
    };
    await storage.writeJSON(`projects/${slug}/docs/${id}.json`, doc, undefined, `feat: create doc "${doc.title}"`);
    return Response.json(doc, { status: 201 });
  }

  // POST /projects/{slug}/sprints — create sprint
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'sprints') {
    const slug = parts[1];
    const body = await request.json() as Record<string, unknown>;
    if (!body['name'] || typeof body['name'] !== 'string' || !body['name'].trim()) {
      return new Response(JSON.stringify({ error: 'name is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const result = await storage.readJSON<Array<Record<string, unknown>>>(`projects/${slug}/sprints.json`);
    const existing = result?.data ?? [];
    const newSprint = { id: `sprint-${Date.now()}`, name: (body['name'] as string).trim(), status: 'planned', createdAt: new Date().toISOString() };
    await storage.writeJSON(`projects/${slug}/sprints.json`, [...existing, newSprint], result?.sha, `feat: create sprint "${newSprint.name}"`);
    return Response.json(newSprint, { status: 201 });
  }

  // POST /projects/{slug}/issues — create issue
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'issues') {
    const slug = parts[1];
    const body = await request.json() as Record<string, unknown>;

    if (!body['title'] || typeof body['title'] !== 'string' || !body['title'].trim()) {
      return new Response(JSON.stringify({ error: 'title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Read meta.json to get next issue number
    const metaResult = await storage.readJSON<{ nextIssueNumber: number }>('meta.json');
    const number = metaResult?.data.nextIssueNumber ?? 1;
    const id = formatIssueId(number);
    const now = new Date().toISOString();

    const projectConfig = config.projects.find((p: ProjectConfig) => p.slug === slug);
    const defaultColumnId = projectConfig?.columns[0]?.id ?? 'todo';

    const issue = {
      id,
      title: (body['title'] as string).trim(),
      description: (body['description'] as string | undefined) ?? '',
      columnId: (body['columnId'] as string | undefined) ?? defaultColumnId,
      priority: (body['priority'] as string | undefined) ?? 'medium',
      assignees: (body['assignees'] as string[] | undefined) ?? [],
      assignee: ((body['assignees'] as string[] | undefined)?.[0]) ?? null,
      labels: (body['labels'] as string[] | undefined) ?? [],
      sprintId: (body['sprintId'] as string | undefined) ?? null,
      attachments: [] as Array<{ name: string; path: string; uploadedBy: string; uploadedAt: string }>,
      activity: [{ type: 'created', by: userLogin, at: now }],
      createdAt: now,
      updatedAt: now,
    };

    // Write issue file, then increment counter
    await storage.writeJSON(
      `projects/${slug}/issues/${id}.json`,
      issue,
      undefined,
      `feat: create issue ${id}`
    );
    await storage.writeJSON(
      'meta.json',
      { nextIssueNumber: number + 1 },
      metaResult?.sha,
      `chore: increment issue counter to ${number + 1}`
    );

    return Response.json(issue, { status: 201 });
  }

  // POST /chat/group/messages
  if (parts[0] === 'chat' && parts[1] === 'group' && parts[2] === 'messages' && parts.length === 3) {
    const body = await request.json() as Record<string, unknown>;
    const hasText = typeof body['text'] === 'string' && (body['text'] as string).length > 0;
    const hasAttachments = Array.isArray(body['attachments']) && (body['attachments'] as unknown[]).length > 0;
    if (!hasText && !hasAttachments) {
      return new Response(JSON.stringify({ error: 'text or attachments is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const msg = await appendMessage(storage, 'group', body, userLogin);
    return Response.json(msg, { status: 201 });
  }

  // POST /projects/{slug}/chat/group/messages
  if (parts[0] === 'projects' && parts[2] === 'chat' && parts[3] === 'group' && parts[4] === 'messages' && parts.length === 5) {
    const slug = parts[1];
    const body = await request.json() as Record<string, unknown>;
    const hasText = typeof body['text'] === 'string' && (body['text'] as string).length > 0;
    const hasAttachments = Array.isArray(body['attachments']) && (body['attachments'] as unknown[]).length > 0;
    if (!hasText && !hasAttachments) {
      return new Response(JSON.stringify({ error: 'text or attachments is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const msg = await appendMessage(storage, `projects/${slug}/group`, body, userLogin);
    return Response.json(msg, { status: 201 });
  }

  // POST /chat/dm/{convId}/messages
  if (parts[0] === 'chat' && parts[1] === 'dm' && parts[2] && parts[2] !== 'messages' && parts[3] === 'messages' && parts.length === 4) {
    const convId = parts[2];
    if (!convId.split('_').includes(userLogin)) {
      return new Response(null, { status: 403 });
    }
    const body = await request.json() as Record<string, unknown>;
    const hasText = typeof body['text'] === 'string' && (body['text'] as string).length > 0;
    const hasAttachments = Array.isArray(body['attachments']) && (body['attachments'] as unknown[]).length > 0;
    if (!hasText && !hasAttachments) {
      return new Response(JSON.stringify({ error: 'text or attachments is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const msg = await appendMessage(storage, `dms/${convId}`, body, userLogin);

    // Auto-add sender to receiver's openDms so the DM appears in their sidebar (non-fatal)
    const receiverLogin = convId.split('_').find((l: string) => l !== userLogin);
    if (receiverLogin) {
      storage.writeJSONWithRetry<{ openDms: string[]; lastRead: Record<string, string> }>(
        `user-state/${receiverLogin}.json`,
        (current) => {
          const state = current ?? { openDms: [], lastRead: {} };
          if (state.openDms.includes(userLogin)) return state;
          return { ...state, openDms: [...state.openDms, userLogin] };
        },
        'chat: auto-add DM to receiver openDms',
      ).catch(err => console.warn('[jellybean-pm] receiver openDms update failed (non-fatal):', err));
    }

    return Response.json(msg, { status: 201 });
  }

  // POST /projects/{slug}/assets — upload a new asset
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'assets') {
    const slug = parts[1];
    const body = await request.json() as Record<string, unknown>;
    const binaryUpload = body['_binaryUpload'] as { path: string; content: string } | undefined;
    if (!binaryUpload?.path || !binaryUpload?.content) {
      return new Response(JSON.stringify({ error: '_binaryUpload is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const assetInput = body['asset'] as { name: string; size: number; mimeType: string } | undefined;
    if (!assetInput?.name) {
      return new Response(JSON.stringify({ error: 'asset.name is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const assetPath = `projects/${slug}/assets/${id}/${assetInput.name}`;
    await storage.writeBinary(assetPath, binaryUpload.content, undefined, `feat: add asset ${assetInput.name}`);
    const asset = {
      id,
      name: assetInput.name,
      path: assetPath,
      size: assetInput.size,
      mimeType: assetInput.mimeType,
      uploadedBy: userLogin,
      uploadedAt: new Date().toISOString(),
    };
    await storage.writeJSONWithRetry<unknown[]>(
      `projects/${slug}/assets.json`,
      (current) => [...(current ?? []), asset],
      `feat: add asset ${assetInput.name}`,
    );
    return Response.json(asset, { status: 201 });
  }

  // POST /chat/user-state
  if (parts[0] === 'chat' && parts[1] === 'user-state' && parts.length === 2) {
    const body = await request.json() as Record<string, unknown>;
    try {
      await storage.writeJSONWithRetry(
        `user-state/${userLogin}.json`,
        () => body,
        'chat: update user state',
      );
    } catch (err) {
      // Non-fatal — client already has the state in memory; log and continue
      console.warn('[jellybean-pm] user-state write failed (non-fatal):', err);
    }
    return Response.json(body);
  }

  return new Response(null, { status: 404 });
});

export const PATCH: APIRoute = withAuth(async ({ request, params }, token) => {
  const path = (params['path'] as string | undefined) ?? '';
  const parts = path.split('/').filter(Boolean);
  const storage = parts[0] === 'projects' ? storageForProject(token, parts[1]) : globalStorage(token);

  // PATCH /projects/{slug}/timeline/{id}
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'timeline') {
    const [, slug, , milestoneId] = parts;
    const result = await storage.readJSON<Array<Record<string, unknown>>>(`projects/${slug}/timeline.json`);
    if (!result) return new Response(null, { status: 404 });
    const patch = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const updated = result.data.map(m =>
      (m['id'] as string) === milestoneId ? { ...m, ...patch, id: m['id'], updatedAt: now } : m
    );
    await storage.writeJSON(`projects/${slug}/timeline.json`, updated, result.sha, `chore: update milestone ${milestoneId}`);
    return Response.json(updated.find(m => (m['id'] as string) === milestoneId));
  }

  // PATCH /projects/{slug}/docs/{id}
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'docs') {
    const [, slug, , docId] = parts;
    const filePath = `projects/${slug}/docs/${docId}.json`;
    const existing = await storage.readJSON<Record<string, unknown>>(filePath);
    if (!existing) return new Response(null, { status: 404 });
    const patch = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();

    const binaryUpload = patch['_binaryUpload'] as { path: string; content: string } | undefined;
    if (binaryUpload) {
      await storage.writeBinary(binaryUpload.path, binaryUpload.content, undefined, `feat: add attachment to ${docId}`);
      delete (patch as Record<string, unknown>)['_binaryUpload'];
    }

    const updatedDoc = { ...existing.data, ...patch, id: existing.data['id'], updatedAt: now };
    await storage.writeJSON(filePath, updatedDoc, existing.sha, `chore: update doc ${docId}`);
    return Response.json(updatedDoc);
  }

  // PATCH /projects/{slug}/sprints/{id}
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'sprints') {
    const [, slug, , sprintId] = parts;
    const result = await storage.readJSON<Array<Record<string, unknown>>>(`projects/${slug}/sprints.json`);
    if (!result) return new Response(null, { status: 404 });
    const patch = await request.json() as Record<string, unknown>;
    const updated = result.data.map(s =>
      (s['id'] as string) === sprintId ? { ...s, ...patch, id: s['id'] } : s
    );
    await storage.writeJSON(`projects/${slug}/sprints.json`, updated, result.sha, `chore: update sprint ${sprintId}`);
    return Response.json(updated.find(s => (s['id'] as string) === sprintId));
  }

  // PATCH /projects/{slug}/issues/{id}
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'issues') {
    const [, slug, , issueId] = parts;
    const filePath = `projects/${slug}/issues/${issueId}.json`;

    const existing = await storage.readJSON<Record<string, unknown>>(filePath);
    if (!existing) return new Response(null, { status: 404 });

    const patch = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();

    // Handle binary attachment upload if present
    const binaryUpload = patch['_binaryUpload'] as { path: string; content: string } | undefined;
    if (binaryUpload) {
      await storage.writeBinary(
        binaryUpload.path,
        binaryUpload.content,
        undefined,
        `feat: add attachment to ${issueId}`
      );
      delete (patch as Record<string, unknown>)['_binaryUpload'];
    }

    // Merge activity events
    const existingActivity = (existing.data['activity'] as unknown[]) ?? [];
    const newActivity = (patch['activity'] as unknown[]) ?? [];

    const updated = {
      ...existing.data,
      ...patch,
      activity: [...existingActivity, ...newActivity],
      updatedAt: now,
    };

    await storage.writeJSON(filePath, updated, existing.sha, `chore: update issue ${issueId}`);
    return Response.json(updated);
  }

  return new Response(null, { status: 404 });
});

export const PUT: APIRoute = withAuth(async ({ request, params }, token) => {
  const path = (params['path'] as string | undefined) ?? '';
  const parts = path.split('/').filter(Boolean);
  const storage = parts[0] === 'projects' ? storageForProject(token, parts[1]) : globalStorage(token);

  // PUT /projects/{slug}/doc-categories — replace entire category list
  if (parts[0] === 'projects' && parts.length === 3 && parts[2] === 'doc-categories') {
    const slug = parts[1];
    const body = await request.json() as string[];
    const result = await storage.readJSON<string[]>(`projects/${slug}/doc-categories.json`);
    await storage.writeJSON(`projects/${slug}/doc-categories.json`, body, result?.sha, 'chore: update doc categories');
    return Response.json(body);
  }

  return new Response(null, { status: 404 });
});

export const DELETE: APIRoute = withAuth(async ({ params }, token, userLogin) => {
  const path = (params['path'] as string | undefined) ?? '';
  const parts = path.split('/').filter(Boolean);
  const storage = parts[0] === 'projects' ? storageForProject(token, parts[1]) : globalStorage(token);

  // DELETE /projects/{slug}/timeline/{id}
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'timeline') {
    const [, slug, , milestoneId] = parts;
    const result = await storage.readJSON<Array<Record<string, unknown>>>(`projects/${slug}/timeline.json`);
    if (!result) return new Response(null, { status: 404 });
    const remaining = result.data.filter(m => (m['id'] as string) !== milestoneId);
    await storage.writeJSON(`projects/${slug}/timeline.json`, remaining, result.sha, `chore: delete milestone ${milestoneId}`);
    return new Response(null, { status: 204 });
  }

  // DELETE /projects/{slug}/docs/{id}
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'docs') {
    const [, slug, , docId] = parts;
    const filePath = `projects/${slug}/docs/${docId}.json`;
    const existing = await storage.readJSON<Record<string, unknown>>(filePath);
    if (!existing) return new Response(null, { status: 404 });

    // Delete attachment if present (non-fatal)
    const attachmentPath = existing.data['attachmentPath'] as string | null;
    if (attachmentPath) {
      try {
        const attachment = await storage.readBinary(attachmentPath);
        if (attachment) {
          await storage.deleteFile(attachmentPath, attachment.sha, `chore: remove attachment for doc ${docId}`);
        }
      } catch {
        // non-fatal — log and continue
        console.warn(`Failed to delete attachment for doc ${docId}`);
      }
    }

    await storage.deleteFile(filePath, existing.sha, `chore: delete doc ${docId}`);
    return new Response(null, { status: 204 });
  }

  // DELETE /projects/{slug}/sprints/{id} — delete sprint, move issues to backlog
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'sprints') {
    const [, slug, , sprintId] = parts;

    // 1. Load all issues and patch those belonging to this sprint
    const now = new Date().toISOString();
    let issueIds: string[] = [];
    try { issueIds = await storage.listIssueIds(slug); } catch { /* no issues yet */ }

    // Sequential writes are required here: parallel amends would each read the same HEAD SHA,
    // race to update the branch ref, and only the last write would survive.
    for (const issueId of issueIds) {
      const filePath = `projects/${slug}/issues/${issueId}.json`;
      const existing = await storage.readJSON<Record<string, unknown>>(filePath);
      if (!existing || (existing.data['sprintId'] as string | null) !== sprintId) continue;
      const updated = { ...existing.data, sprintId: null, updatedAt: now };
      await storage.writeJSON(filePath, updated, existing.sha, `chore: move issue ${issueId} to backlog (sprint deleted)`);
    }

    // 2. Remove sprint from sprints.json
    const sprintsResult = await storage.readJSON<Array<Record<string, unknown>>>(`projects/${slug}/sprints.json`);
    if (sprintsResult) {
      const remaining = sprintsResult.data.filter(s => (s['id'] as string) !== sprintId);
      await storage.writeJSON(`projects/${slug}/sprints.json`, remaining, sprintsResult.sha, `chore: delete sprint ${sprintId}`);
    }

    return new Response(null, { status: 204 });
  }

  // DELETE /files/{path} — delete attachment binary
  if (parts[0] === 'files' && parts.length > 1) {
    const filePath = parts.slice(1).join('/');
    const file = await storage.readBinary(filePath);
    if (!file) return new Response(null, { status: 404 });
    await storage.deleteFile(filePath, file.sha, `chore: remove attachment ${parts.at(-1)}`);
    return new Response(null, { status: 204 });
  }

  // DELETE /projects/{slug}/issues/{id}
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'issues') {
    const [, slug, , issueId] = parts;
    const filePath = `projects/${slug}/issues/${issueId}.json`;

    const existing = await storage.readJSON(filePath);
    if (!existing) return new Response(null, { status: 404 });

    await storage.deleteFile(filePath, existing.sha, `chore: delete issue ${issueId}`);
    return new Response(null, { status: 204 });
  }

  // DELETE /projects/{slug}/chat/group/messages/{msgId} — message author or repo owner
  if (parts[0] === 'projects' && parts[2] === 'chat' && parts[3] === 'group' && parts[4] === 'messages' && parts.length === 6) {
    const slug = parts[1];
    const msgId = parts[5];
    const repoOwner = config.storage.repo.split('/')[0];
    const convKey = `projects/${slug}/group`;

    type PageData = { messages: Array<{ id: string; authorLogin: string }>; full: boolean };
    type MetaShape = { group: { pageCount: number }; dms: Record<string, { pageCount: number }>; projects?: { [s: string]: { group: { pageCount: number } } } };
    const meta = await storage.readJSON<MetaShape>('chat/meta.json');
    const pageCount = meta?.data?.projects?.[slug]?.group?.pageCount ?? 1;

    let found = false;
    for (let i = pageCount - 1; i >= 0; i--) {
      const filePath = `chat/${convKey}/messages-${padPage(i)}.json`;
      const page = await storage.readJSON<PageData>(filePath);
      if (!page) continue;
      const msg = page.data.messages.find(m => m.id === msgId);
      if (!msg) continue;

      if (userLogin !== repoOwner && msg.authorLogin !== userLogin) {
        return new Response(null, { status: 403 });
      }

      await storage.writeJSONWithRetry<PageData>(
        filePath,
        (current) => {
          if (!current) return { messages: [], full: false };
          return { ...current, messages: current.messages.filter(m => m.id !== msgId) };
        },
        `chore: delete message ${msgId}`,
      );
      found = true;
      break;
    }

    if (!found) return new Response(null, { status: 404 });
    return new Response(null, { status: 204 });
  }

  // DELETE /chat/group/messages/{msgId} — repo owner only
  // DELETE /chat/dm/{convId}/messages/{msgId} — repo owner only
  const isChatMsgDelete =
    (parts[0] === 'chat' && parts[1] === 'group' && parts[2] === 'messages' && parts.length === 4) ||
    (parts[0] === 'chat' && parts[1] === 'dm' && parts[3] === 'messages' && parts.length === 5);
  if (isChatMsgDelete) {
    const repoOwner = config.storage.repo.split('/')[0];
    const msgId = parts[parts.length - 1];
    const convKey = parts[1] === 'group' ? 'group' : `dms/${parts[2]}`;
    const dmKey = convKey === 'group' ? undefined : convKey.slice('dms/'.length);

    type PageData = { messages: Array<{ id: string; authorLogin: string }>; full: boolean };
    const meta = await storage.readJSON<{ group: { pageCount: number }; dms: { [k: string]: { pageCount: number } } }>('chat/meta.json');
    const pageCount = convKey === 'group'
      ? (meta?.data?.group?.pageCount ?? 1)
      : (meta?.data?.dms?.[dmKey!]?.pageCount ?? 1);

    let found = false;
    for (let i = pageCount - 1; i >= 0; i--) {
      const filePath = `chat/${convKey}/messages-${padPage(i)}.json`;
      const page = await storage.readJSON<PageData>(filePath);
      if (!page) continue;
      const msg = page.data.messages.find(m => m.id === msgId);
      if (!msg) continue;

      // Only the message author or the repo owner may delete
      if (userLogin !== repoOwner && msg.authorLogin !== userLogin) {
        return new Response(null, { status: 403 });
      }

      await storage.writeJSONWithRetry<PageData>(
        filePath,
        (current) => {
          if (!current) return { messages: [], full: false };
          return { ...current, messages: current.messages.filter(m => m.id !== msgId) };
        },
        `chore: delete message ${msgId}`,
      );
      found = true;
      break;
    }

    if (!found) return new Response(null, { status: 404 });
    return new Response(null, { status: 204 });
  }

  // DELETE /chat/dm/{convId} — delete entire DM conversation + history (admin only)
  if (parts[0] === 'chat' && parts[1] === 'dm' && parts.length === 3) {
    const repoOwner = config.storage.repo.split('/')[0];
    if (userLogin !== repoOwner) return new Response(null, { status: 403 });

    const convId = parts[2];
    const convKey = `dms/${convId}`;
    type MetaShape = { group: { pageCount: number; latestMsgId?: string }; dms: { [k: string]: { pageCount: number; latestMsgId?: string } } };
    const meta = await storage.readJSON<MetaShape>('chat/meta.json');
    const pageCount = meta?.data?.dms[convId]?.pageCount ?? 0;

    for (let i = 0; i < pageCount; i++) {
      const filePath = `chat/${convKey}/messages-${padPage(i)}.json`;
      const page = await storage.readJSON(filePath);
      if (page) {
        await storage.deleteFile(filePath, page.sha, `chore: delete DM ${convId} page ${i}`);
      }
    }

    await storage.writeJSONWithRetry<MetaShape>(
      'chat/meta.json',
      (current) => {
        if (!current) return { group: { pageCount: 0 }, dms: {} };
        const { [convId]: _removed, ...remainingDms } = current.dms;
        return { ...current, dms: remainingDms };
      },
      `chore: remove DM ${convId} from meta`,
    );

    return new Response(null, { status: 204 });
  }

  // DELETE /projects/{slug}/assets/{id}
  if (parts[0] === 'projects' && parts.length === 4 && parts[2] === 'assets') {
    const [, slug, , assetId] = parts;
    const result = await storage.readJSON<Array<Record<string, unknown>>>(`projects/${slug}/assets.json`);
    if (!result) return new Response(null, { status: 404 });
    const asset = result.data.find(a => a['id'] === assetId);
    if (!asset) return new Response(null, { status: 404 });
    // Delete binary file
    const fileResult = await storage.readBinary(asset['path'] as string);
    if (fileResult) {
      await storage.deleteFile(asset['path'] as string, fileResult.sha, `chore: delete asset ${asset['name']}`);
    }
    // Remove from index
    const remaining = result.data.filter(a => a['id'] !== assetId);
    await storage.writeJSON(`projects/${slug}/assets.json`, remaining, result.sha, `chore: delete asset ${assetId}`);
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 404 });
});
