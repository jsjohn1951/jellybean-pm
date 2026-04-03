import { describe, it, expect } from 'vitest';
import { defineConfig } from './schema';

describe('defineConfig', () => {
  const base = {
    storage: { repo: 'owner/repo', dataPath: '.jellybean-pm' },
    projects: [{ slug: 'app', name: 'App', columns: [] }],
  };

  it('returns config with storage and projects preserved', () => {
    const result = defineConfig(base);
    expect(result.storage.repo).toBe('owner/repo');
    expect(result.storage.dataPath).toBe('.jellybean-pm');
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].slug).toBe('app');
  });

  it('applies default columns when project.columns is empty', () => {
    const result = defineConfig(base);
    expect(result.projects[0].columns).toHaveLength(4);
    expect(result.projects[0].columns.map(c => c.id)).toEqual(['todo', 'in-progress', 'review', 'done']);
  });

  it('throws when storage.repo is missing', () => {
    expect(() => defineConfig({ ...base, storage: { repo: '', dataPath: '.jellybean-pm' } }))
      .toThrow('config.storage.repo is required');
  });

  it('throws when storage.dataPath is missing', () => {
    expect(() => defineConfig({ ...base, storage: { repo: 'owner/repo', dataPath: '' } }))
      .toThrow('config.storage.dataPath is required');
  });

  it('throws when projects is empty', () => {
    expect(() => defineConfig({ ...base, projects: [] }))
      .toThrow('config.projects must have at least one entry');
  });
});
