import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubStorage } from './storage';
import * as clientModule from './client';

const mockGetFile = vi.fn();
const mockPutFile = vi.fn();
const mockListDirectory = vi.fn();

vi.spyOn(clientModule, 'GitHubClient').mockImplementation(() => ({
  getFile: mockGetFile,
  putFile: mockPutFile,
  listDirectory: mockListDirectory,
} as unknown as clientModule.GitHubClient));

const config = {
  storage: { repo: 'owner/repo', dataPath: '.jellybean-pm' },
  projects: [{ slug: 'app', name: 'App', columns: [] }],
};

describe('GitHubStorage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('readJSON returns null when file not found (cold start)', async () => {
    mockGetFile.mockResolvedValue(null);
    const storage = new GitHubStorage('token', config.storage);
    const result = await storage.readJSON('meta.json');
    expect(result).toBeNull();
    expect(mockGetFile).toHaveBeenCalledWith('.jellybean-pm/meta.json');
  });

  it('readJSON decodes base64 and parses JSON', async () => {
    const data = { nextIssueNumber: 5 };
    mockGetFile.mockResolvedValue({
      sha: 'abc123',
      content: Buffer.from(JSON.stringify(data)).toString('base64'),
    });
    const storage = new GitHubStorage('token', config.storage);
    const result = await storage.readJSON<typeof data>('meta.json');
    expect(result?.data).toEqual(data);
    expect(result?.sha).toBe('abc123');
  });

  it('listIssueIds returns [] when directory not found', async () => {
    mockListDirectory.mockResolvedValue([]);
    const storage = new GitHubStorage('token', config.storage);
    const ids = await storage.listIssueIds('app');
    expect(ids).toEqual([]);
  });

  it('listIssueIds filters to .json files and strips extension', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'ISS-001.json', path: '...', type: 'file' },
      { name: 'ISS-002.json', path: '...', type: 'file' },
      { name: '.gitkeep',     path: '...', type: 'file' },
    ]);
    const storage = new GitHubStorage('token', config.storage);
    const ids = await storage.listIssueIds('app');
    expect(ids).toEqual(['ISS-001', 'ISS-002']);
  });

  it('writeJSON encodes data as base64 and calls putFile with correct path', async () => {
    mockPutFile.mockResolvedValue(undefined);
    const storage = new GitHubStorage('token', config.storage);
    await storage.writeJSON('meta.json', { nextIssueNumber: 1 }, undefined, 'test');
    expect(mockPutFile).toHaveBeenCalledWith(
      '.jellybean-pm/meta.json',
      expect.any(String),  // base64 content
      undefined,
      'test'
    );
    // Verify the content is valid base64-encoded JSON
    const [, content] = mockPutFile.mock.calls[0];
    const decoded = JSON.parse(Buffer.from(content, 'base64').toString('utf8'));
    expect(decoded).toEqual({ nextIssueNumber: 1 });
  });
});
