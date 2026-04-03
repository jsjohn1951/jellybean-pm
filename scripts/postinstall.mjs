#!/usr/bin/env node
// Runs after `npm install jellybean-pm`.
// Creates a starter jellybean-pm.config.ts in the consumer's project root
// if one does not already exist. Always fails silently — never breaks install.

import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the package's own directory (wherever it lives inside node_modules).
const packageDir = resolve(fileURLToPath(import.meta.url), '..', '..');

// Walk up from packageDir until we exit all node_modules nesting.
// Handles flat npm/yarn layouts as well as pnpm's virtual store:
//   .pnpm/jellybean-pm@x.y.z/node_modules/jellybean-pm/
function findProjectRoot(dir) {
  let current = dir;
  while (true) {
    const parent = resolve(current, '..');
    if (parent === current) return null; // hit filesystem root
    if (current.includes('node_modules')) {
      current = parent;
      continue;
    }
    // We've exited node_modules — this directory is the consumer's root.
    return current;
  }
}

try {
  const projectRoot = findProjectRoot(packageDir);
  if (!projectRoot) process.exit(0);

  const configPath = join(projectRoot, 'jellybean-pm.config.ts');
  if (existsSync(configPath)) process.exit(0);

  const template = `import { defineConfig } from 'jellybean-pm';

export default defineConfig({
  storage: {
    repo: 'your-org/your-repo',
    dataPath: '.jellybean-pm',
    branch: 'main',
  },
  ui: {
    brand: {
      name: 'My Project PM',
    },
  },
  projects: [
    {
      slug: 'my-project',
      name: 'My Project',
      columns: [
        { id: 'todo',        name: 'To Do'       },
        { id: 'in-progress', name: 'In Progress' },
        { id: 'review',      name: 'Review'      },
        { id: 'done',        name: 'Done'         },
      ],
    },
  ],
});
`;

  writeFileSync(configPath, template, 'utf8');
  console.log('[jellybean-pm] Created jellybean-pm.config.ts — edit it to configure your GitHub repo and projects.');
} catch {
  // Never break the consumer's install.
}
