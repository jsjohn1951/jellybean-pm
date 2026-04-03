export interface GitHubClientOptions {
  token: string;
  repo: string;    // "owner/repo"
  branch?: string; // default: 'main'
}

export interface GitHubFile {
  sha: string;
  content: string;  // base64
  encoding: 'base64';
}

function githubError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export class GitHubClient {
  private readonly base = 'https://api.github.com';
  private readonly branch: string;

  constructor(private readonly opts: GitHubClientOptions) {
    this.branch = opts.branch ?? 'main';
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.opts.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'cormonity-jellybean-pm/1.0',
    };
  }

  async getFile(path: string): Promise<GitHubFile | null> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/contents/${path}?ref=${this.branch}`,
      { headers: this.headers(), cache: 'no-store' as RequestCache }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[jellybean-pm] GitHub GET ${path} failed: ${res.status} — ${body}`);
      throw githubError(`GitHub GET ${path} failed: ${res.status}`, res.status);
    }
    return res.json() as Promise<GitHubFile>;
  }

  async putFile(path: string, content: string, sha: string | undefined, message: string): Promise<{ sha: string }> {
    const body: Record<string, unknown> = { message, content, branch: this.branch };
    if (sha) body['sha'] = sha;
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/contents/${path}`,
      { method: 'PUT', headers: this.headers(), body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(githubError(`GitHub PUT ${path} failed: ${res.status}`, res.status), { body: err });
    }
    const data = await res.json() as { content: { sha: string } };
    return { sha: data.content.sha };
  }

  async listCollaborators(): Promise<Array<{ login: string; avatar_url: string }>> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/collaborators`,
      { headers: this.headers() }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[jellybean-pm] GitHub collaborators failed: ${res.status} — ${body}`);
      throw githubError(`GitHub collaborators failed: ${res.status}`, res.status);
    }
    const data: unknown = await res.json();
    return (data as Array<{ login: string; avatar_url: string }>).map(u => ({ login: u.login, avatar_url: u.avatar_url }));
  }

  async listContributors(): Promise<Array<{ login: string; avatar_url: string; contributions: number }>> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/contributors`,
      { headers: this.headers() }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[jellybean-pm] GitHub contributors failed: ${res.status} — ${body}`);
      throw githubError(`GitHub contributors failed: ${res.status}`, res.status);
    }
    const data: unknown = await res.json();
    return (data as Array<{ login: string; avatar_url: string; contributions: number }>)
      .map(u => ({ login: u.login, avatar_url: u.avatar_url, contributions: u.contributions }));
  }

  async deleteFile(path: string, sha: string, message: string): Promise<void> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/contents/${path}`,
      { method: 'DELETE', headers: this.headers(), body: JSON.stringify({ message, sha, branch: this.branch }) }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(githubError(`GitHub DELETE ${path} failed: ${res.status}`, res.status), { body: err });
    }
  }

  async getRef(branch: string): Promise<{ sha: string }> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/git/refs/heads/${branch}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw githubError(`GitHub getRef ${branch} failed: ${res.status}`, res.status);
    const data = await res.json() as { object: { sha: string } };
    return { sha: data.object.sha };
  }

  async getCommit(sha: string): Promise<{ sha: string; tree: { sha: string }; parents: { sha: string }[] }> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/git/commits/${sha}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw githubError(`GitHub getCommit ${sha} failed: ${res.status}`, res.status);
    return res.json() as Promise<{ sha: string; tree: { sha: string }; parents: { sha: string }[] }>;
  }

  async createBlob(base64Content: string): Promise<{ sha: string }> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/git/blobs`,
      { method: 'POST', headers: this.headers(), body: JSON.stringify({ content: base64Content, encoding: 'base64' }) }
    );
    if (!res.ok) throw githubError(`GitHub createBlob failed: ${res.status}`, res.status);
    return res.json() as Promise<{ sha: string }>;
  }

  async createTree(
    baseTreeSha: string,
    updates: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }>
  ): Promise<{ sha: string }> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/git/trees`,
      { method: 'POST', headers: this.headers(), body: JSON.stringify({ base_tree: baseTreeSha, tree: updates }) }
    );
    if (!res.ok) throw githubError(`GitHub createTree failed: ${res.status}`, res.status);
    return res.json() as Promise<{ sha: string }>;
  }

  async createCommit(message: string, treeSha: string, parentShas: string[]): Promise<{ sha: string }> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/git/commits`,
      { method: 'POST', headers: this.headers(), body: JSON.stringify({ message, tree: treeSha, parents: parentShas }) }
    );
    if (!res.ok) throw githubError(`GitHub createCommit failed: ${res.status}`, res.status);
    return res.json() as Promise<{ sha: string }>;
  }

  async updateRef(branch: string, sha: string): Promise<void> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/git/refs/heads/${branch}`,
      { method: 'PATCH', headers: this.headers(), body: JSON.stringify({ sha, force: true }) }
    );
    if (!res.ok) throw githubError(`GitHub updateRef ${branch} failed: ${res.status}`, res.status);
  }

  async listDirectory(path: string): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
    const res = await fetch(
      `${this.base}/repos/${this.opts.repo}/contents/${path}?ref=${this.branch}`,
      { headers: this.headers() }
    );
    if (res.status === 404) return [];
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[jellybean-pm] GitHub LIST ${path} failed: ${res.status} — ${body} (branch: ${this.branch})`);
      throw githubError(`GitHub LIST ${path} failed: ${res.status}`, res.status);
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      console.error(`[jellybean-pm] GitHub LIST ${path} returned non-array:`, JSON.stringify(data).slice(0, 200));
      throw githubError(`GitHub LIST ${path} returned non-array (path may point to a file, not a directory)`, res.status);
    }
    return data as Array<{ name: string; path: string; type: 'file' | 'dir' }>;
  }
}
