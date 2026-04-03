import type { AstroIntegration } from 'astro';
import type { Plugin } from 'vite';
import type { JellybeanPMConfig } from './config/schema';

function virtualConfigPlugin(config: JellybeanPMConfig): Plugin {
  const virtualId = 'virtual:jellybean-pm/config';
  const resolvedId = '\0' + virtualId;
  return {
    name: 'jellybean-pm-config',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) {
        return `export default ${JSON.stringify(config)};`;
      }
    },
  };
}

export function jellybeanPM(config: JellybeanPMConfig): AstroIntegration {
  return {
    name: 'jellybean-pm',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig, logger }) => {
        logger.info('JellyBean PM: registering routes');

        const base = new URL('./pages/', import.meta.url);

        const basePath = config.ui?.basePath ?? '/project-management';

        injectRoute({
          pattern: basePath,
          entrypoint: new URL('app.astro', base),
          prerender: false,
        });
        injectRoute({
          pattern: `${basePath}/[...path]`,
          entrypoint: new URL('app.astro', base),
          prerender: false,
        });
        injectRoute({
          pattern: '/api/jellybean/auth/login',
          entrypoint: new URL('api/auth/login.ts', base),
          prerender: false,
        });
        injectRoute({
          pattern: '/api/jellybean/auth/callback',
          entrypoint: new URL('api/auth/callback.ts', base),
          prerender: false,
        });
        injectRoute({
          pattern: '/api/jellybean/auth/logout',
          entrypoint: new URL('api/auth/logout.ts', base),
          prerender: false,
        });
        injectRoute({
          pattern: '/api/jellybean/auth/me',
          entrypoint: new URL('api/auth/me.ts', base),
          prerender: false,
        });
        injectRoute({
          pattern: '/api/jellybean/data/[...path]',
          entrypoint: new URL('api/data.ts', base),
          prerender: false,
        });

        updateConfig({
          vite: {
            plugins: [virtualConfigPlugin(config)],
            optimizeDeps: {
              include: ['swr', 'use-sync-external-store/shim/index.js'],
            },
          },
        });
      },
    },
  };
}
