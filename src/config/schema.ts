export interface StorageConfig {
  repo: string;        // e.g. "owner/repo"
  dataPath: string;    // e.g. ".jellybean-pm"
  branch?: string;                  // default: 'main'
  commitMode?: 'create' | 'amend'; // default: 'create' — 'amend' replaces HEAD instead of adding commits
}

export interface ColumnConfig {
  id: string;
  name: string;
}

export interface ProjectConfig {
  slug: string;
  name: string;
  columns: ColumnConfig[];
  storage?: StorageConfig;          // full override; if absent, top-level storage is used
  _resolvedStorage?: StorageConfig; // set by defineConfig — do not set manually
}

export interface JellybeanPMConfig {
  storage?: StorageConfig;          // optional top-level default; required if any project omits storage
  ui?: {
    basePath?: string;              // URL prefix for the PM app, default: '/project-management'
    brand?: {
      name?: string;
      logo?: string;                // img src — URL, public path (e.g. '/logo.svg'), or relative path
    };
  };
  projects: ProjectConfig[];
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'todo',        name: 'To Do'       },
  { id: 'in-progress', name: 'In Progress' },
  { id: 'review',      name: 'Review'      },
  { id: 'done',        name: 'Done'        },
];

function withStorageDefaults(s: StorageConfig): StorageConfig {
  return { branch: 'main', commitMode: 'create', ...s };
}

export function defineConfig(config: JellybeanPMConfig): JellybeanPMConfig {
  if (!config.projects?.length) throw new Error('[jellybean-pm] config.projects must have at least one entry');

  const projects = config.projects.map(p => {
    const raw = p.storage ?? config.storage;
    if (!raw?.repo?.trim())     throw new Error(`[jellybean-pm] project "${p.slug}" has no resolvable storage.repo`);
    if (!raw?.dataPath?.trim()) throw new Error(`[jellybean-pm] project "${p.slug}" has no resolvable storage.dataPath`);
    return {
      ...p,
      columns: p.columns?.length ? p.columns : [...DEFAULT_COLUMNS],
      _resolvedStorage: withStorageDefaults(raw),
    };
  });

  return {
    ...config,
    storage: config.storage ? withStorageDefaults(config.storage) : undefined,
    projects,
  };
}
