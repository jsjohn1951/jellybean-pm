import { GitHubClient } from './client';
import type { StorageConfig } from '../config/schema';

function b64Encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64Decode(str: string): string {
  // GitHub returns base64 with newlines — strip them
  const bytes = Uint8Array.from(atob(str.replace(/\n/g, '')), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHubStorage {
  private client: GitHubClient;
  private root: string;
  private branch: string;
  private commitMode: 'create' | 'amend';

  constructor(token: string, storage: StorageConfig) {
    this.client = new GitHubClient({ token, repo: storage.repo, branch: storage.branch });
    this.root = storage.dataPath;
    this.branch = storage.branch ?? 'main';
    this.commitMode = storage.commitMode ?? 'create';
  }

  private path(...parts: string[]): string {
    return [this.root, ...parts].join('/');
  }

  // Replaces the current HEAD commit in-place using the Git Data API.
  // base64Content === null removes the file from the tree (delete).
  private async amendHead(fullPath: string, base64Content: string | null): Promise<void> {
    await this.amendHeadBatch([{ fullPath, base64Content }]);
  }

  // Atomically writes multiple files in a single commit.
  // Blobs are created in parallel; a single createTree/createCommit/updateRef sequence follows.
  private async amendHeadBatch(files: Array<{ fullPath: string; base64Content: string | null }>): Promise<void> {
    const ref = await this.client.getRef(this.branch);
    const commit = await this.client.getCommit(ref.sha);
    const parentShas = commit.parents.map(p => p.sha);

    // Create all blobs in parallel
    const blobShas = await Promise.all(
      files.map(f =>
        f.base64Content !== null
          ? this.client.createBlob(f.base64Content).then(b => b.sha)
          : Promise.resolve(null)
      )
    );

    const treeEntries = files.map((f, i) => ({
      path: f.fullPath,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blobShas[i],
    }));

    const newTree = await this.client.createTree(commit.tree.sha, treeEntries);
    const newCommit = await this.client.createCommit(
      'chore: jellybean-pm data',
      newTree.sha,
      parentShas,
    );
    await this.client.updateRef(this.branch, newCommit.sha);
  }

  async readJSON<T>(relPath: string): Promise<{ data: T; sha: string } | null> {
    const file = await this.client.getFile(this.path(relPath));
    if (!file) return null;
    return { data: JSON.parse(b64Decode(file.content)) as T, sha: file.sha };
  }

  async writeJSON<T>(relPath: string, data: T, sha: string | undefined, message: string): Promise<void> {
    const content = b64Encode(JSON.stringify(data, null, 2));
    if (this.commitMode === 'amend') {
      await this.amendHead(this.path(relPath), content);
    } else {
      await this.client.putFile(this.path(relPath), content, sha, message);
    }
  }

  // Writes multiple JSON files in a single atomic commit (amend mode) or sequentially (create mode).
  async writeJSONBatch(entries: Array<{ relPath: string; data: unknown; sha?: string; message?: string }>): Promise<void> {
    if (this.commitMode === 'amend') {
      const files = entries.map(e => ({
        fullPath: this.path(e.relPath),
        base64Content: b64Encode(JSON.stringify(e.data, null, 2)),
      }));
      await this.amendHeadBatch(files);
    } else {
      for (const e of entries) {
        const content = b64Encode(JSON.stringify(e.data, null, 2));
        await this.client.putFile(this.path(e.relPath), content, e.sha, e.message ?? 'chore: jellybean-pm data');
      }
    }
  }

  /**
   * Writes a JSON file using optimistic concurrency (putFile with SHA check),
   * bypassing amend mode. On 409 conflict, re-reads and retries with the updater.
   */
  async writeJSONWithRetry<T>(
    relPath: string,
    updater: (current: T | null) => T,
    message: string,
    maxRetries = 3,
  ): Promise<{ data: T; sha: string }> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const existing = await this.readJSON<T>(relPath);
      const updated = updater(existing?.data ?? null);
      const content = b64Encode(JSON.stringify(updated, null, 2));
      try {
        const result = await this.client.putFile(this.path(relPath), content, existing?.sha, message);
        return { data: updated, sha: result.sha };
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        // Retry on conflict (409) or transient network errors (no status = fetch failed)
        const isRetryable = status === 409 || status === undefined;
        if (isRetryable && attempt < maxRetries) {
          // Jittered backoff before retry
          await new Promise(r => setTimeout(r, (attempt + 1) * 200 + Math.random() * 200));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`writeJSONWithRetry: exceeded ${maxRetries} retries for ${relPath}`);
  }

  async listIssueIds(projectSlug: string): Promise<string[]> {
    const entries = await this.client.listDirectory(this.path('projects', projectSlug, 'issues'));
    return entries
      .filter(e => e.type === 'file' && e.name.endsWith('.json'))
      .map(e => e.name.replace('.json', ''));
  }

  async listDocIds(projectSlug: string): Promise<string[]> {
    const entries = await this.client.listDirectory(this.path('projects', projectSlug, 'docs'));
    return entries
      .filter(e => e.type === 'file' && e.name.endsWith('.json'))
      .map(e => e.name.replace('.json', ''));
  }

  async writeBinary(relPath: string, base64Content: string, sha: string | undefined, message: string): Promise<void> {
    if (this.commitMode === 'amend') {
      await this.amendHead(this.path(relPath), base64Content);
    } else {
      await this.client.putFile(this.path(relPath), base64Content, sha, message);
    }
  }

  async readBinary(relPath: string): Promise<{ content: string; sha: string } | null> {
    const file = await this.client.getFile(this.path(relPath));
    if (!file) return null;
    return { content: file.content.replace(/\n/g, ''), sha: file.sha };
  }

  async deleteFile(relPath: string, sha: string, message: string): Promise<void> {
    if (this.commitMode === 'amend') {
      await this.amendHead(this.path(relPath), null);
    } else {
      await this.client.deleteFile(this.path(relPath), sha, message);
    }
  }

  async listCollaborators(): Promise<Array<{ login: string; avatar_url: string }>> {
    return this.client.listCollaborators();
  }

  async listContributors(): Promise<Array<{ login: string; avatar_url: string; contributions: number }>> {
    return this.client.listContributors();
  }
}
