# jellybean-pm

A full-featured project management integration for [Astro](https://astro.build), powered by GitHub as the backend. Ship a Kanban board, calendar, chat, docs, and asset manager directly inside your Astro site — no external database required.

## Features

- **Kanban board** — drag-and-drop issues across fully configurable columns
- **Calendar view** — visualize deadlines and sprint timelines
- **Goals / Milestones** — epics and milestones for roadmap planning
- **Real-time chat** — group chat, DMs, and per-project channels with file attachments
- **Docs browser** — built-in markdown documentation viewer
- **Asset manager** — upload and manage project files
- **GitHub-backed storage** — all data lives in a Git repository you own
- **GitHub OAuth** — team members log in with their existing GitHub accounts
- **Time tracking** — per-issue timers with accumulated session time
- **Sprint management** — create, activate, and complete sprints

## Requirements

- Astro ≥ 5.0
- React ≥ 18
- A GitHub repository to store project data
- A GitHub OAuth App for authentication

## Install

```bash
npm install jellybean-pm
```

A `jellybean-pm.config.ts` starter file will be created in your project root automatically.

## Quick Start

### 1. Create a GitHub OAuth App

Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**.

| Field | Value |
|---|---|
| Homepage URL | `http://localhost:4321` (or your production URL) |
| Authorization callback URL | `http://localhost:4321/api/jellybean/auth/callback` |

Copy the **Client ID** and generate a **Client Secret**.

### 2. Set environment variables

```bash
# .env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
SESSION_SECRET=a_random_32_char_string
```

### 3. Configure the integration

Edit the generated `jellybean-pm.config.ts`:

```ts
import { defineConfig } from 'jellybean-pm';

export default defineConfig({
  storage: {
    repo: 'your-org/your-repo',   // GitHub repo that stores PM data
    dataPath: '.jellybean-pm',     // directory inside the repo
    branch: 'main',
  },
  ui: {
    brand: {
      name: 'My Project PM',
      logo: '/path/to/logo.svg',   // optional
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
```

### 4. Register the Astro integration

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import pm from 'jellybean-pm';
import pmConfig from './jellybean-pm.config';

export default defineConfig({
  integrations: [react(), pm(pmConfig)],
});
```

### 5. Start your dev server

```bash
npm run dev
```

Navigate to `http://localhost:4321/project-management` to see your board.

## Configuration Reference

### Top-level options

| Option | Type | Default | Description |
|---|---|---|---|
| `storage` | `StorageConfig` | — | Default storage for all projects |
| `ui.basePath` | `string` | `'/project-management'` | URL prefix for the PM interface |
| `ui.brand.name` | `string` | `'JellyBean PM'` | Display name in the nav |
| `ui.brand.logo` | `string` | — | URL or path to logo image |
| `projects` | `ProjectConfig[]` | required | Array of project definitions |

### `StorageConfig`

| Option | Type | Default | Description |
|---|---|---|---|
| `repo` | `string` | required | GitHub repository in `owner/repo` format |
| `dataPath` | `string` | required | Directory inside the repo where data is stored |
| `branch` | `string` | `'main'` | Branch to read and write data on |
| `commitMode` | `'create' \| 'amend'` | `'create'` | `'amend'` rewrites HEAD instead of creating new commits — useful to keep Git history clean |

### `ProjectConfig`

| Option | Type | Default | Description |
|---|---|---|---|
| `slug` | `string` | required | URL-safe identifier (e.g. `'my-project'`) |
| `name` | `string` | required | Display name |
| `columns` | `ColumnConfig[]` | 4 default columns | Kanban columns (id + name pairs) |
| `storage` | `StorageConfig` | inherits top-level | Per-project storage override |

## Environment Variables

| Variable | Description |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `SESSION_SECRET` | Secret for encrypting session cookies (min 32 chars) |

## Multiple Projects

Each project can point to a different repository or branch:

```ts
export default defineConfig({
  storage: { repo: 'my-org/shared-pm', dataPath: '.jellybean-pm' },
  projects: [
    { slug: 'frontend', name: 'Frontend', columns: [...] },
    {
      slug: 'backend',
      name: 'Backend',
      // overrides top-level storage for this project only
      storage: { repo: 'my-org/backend', dataPath: '.jellybean-pm' },
      columns: [...],
    },
  ],
});
```

## Contributing

```bash
git clone https://github.com/jsjohn1951/jellybean-pm.git
cd jellybean-pm
npm install
npm test
```

Pull requests are welcome. Please open an issue first for substantial changes.

## License

MIT
