import { posix } from 'node:path';

/**
 * Layer rules from docs/architecture.md §9. Everything under src/ that is not classified
 * into a layer is "legacy" and must be listed in allowlist.ts.
 */

export type LayerId =
  | 'server/domain'
  | 'server/application'
  | 'server/infrastructure'
  | 'server/interface'
  | 'server/composition'
  | 'web/domain'
  | 'web/application'
  | 'web/infrastructure'
  | 'web/ui'
  | 'web/shared'
  | 'web/app'
  | 'shared'
  | 'legacy';

export interface Classified {
  layer: LayerId;
  /** Only for web feature layers: `src/web/features/<feature>/...`. */
  feature?: string;
}

export function classify(path: string): Classified {
  const server = /^src\/server\/(domain|application|infrastructure|interface)\//.exec(path);
  if (server) return { layer: `server/${server[1]}` as LayerId };
  if (path === 'src/server/composition.ts') return { layer: 'server/composition' };

  const feature = /^src\/web\/features\/([^/]+)\/(domain|application|infrastructure|ui)\//.exec(path);
  if (feature) return { layer: `web/${feature[2]}` as LayerId, feature: feature[1] };
  if (path.startsWith('src/web/shared/')) return { layer: 'web/shared' };
  if (path.startsWith('src/web/app/')) return { layer: 'web/app' };

  if (path.startsWith('src/shared/')) return { layer: 'shared' };
  return { layer: 'legacy' };
}

export interface LayerRule {
  /** Bare package names (matches the name and its subpaths) or a `prefix*` for prefixes. */
  forbidPackages: string[];
  /** Layers that files in this layer must not import (resolved relative imports). */
  forbidLayers: LayerId[];
  /** Web feature layers: forbid importing another feature's internals. */
  sameFeatureOnly?: boolean;
}

const SERVER_INFRA_PACKAGES = ['fastify', '@fastify/*', 'drizzle-orm', 'better-sqlite3'];

export const RULES: Partial<Record<LayerId, LayerRule>> = {
  'server/domain': {
    forbidPackages: SERVER_INFRA_PACKAGES,
    forbidLayers: ['server/application', 'server/infrastructure', 'server/interface', 'server/composition', 'legacy'],
  },
  'server/application': {
    forbidPackages: SERVER_INFRA_PACKAGES,
    forbidLayers: ['server/infrastructure', 'server/interface', 'server/composition', 'legacy'],
  },
  'server/infrastructure': {
    forbidPackages: [],
    forbidLayers: ['server/interface', 'server/composition'],
  },
  // Only composition.ts may wire infrastructure into the HTTP layer.
  'server/interface': {
    forbidPackages: ['drizzle-orm', 'better-sqlite3'],
    forbidLayers: ['server/infrastructure', 'server/composition'],
  },
  'web/domain': {
    forbidPackages: ['react', 'react-dom', 'react-router'],
    forbidLayers: ['web/application', 'web/infrastructure', 'web/ui', 'web/app', 'legacy'],
    sameFeatureOnly: true,
  },
  'web/application': {
    forbidPackages: [],
    forbidLayers: ['web/infrastructure', 'web/ui', 'web/app'],
    sameFeatureOnly: true,
  },
  'web/infrastructure': {
    forbidPackages: [],
    forbidLayers: ['web/ui', 'web/app'],
    sameFeatureOnly: true,
  },
  'web/ui': {
    forbidPackages: [],
    forbidLayers: ['web/infrastructure', 'web/app'],
    sameFeatureOnly: true,
  },
  'web/shared': {
    forbidPackages: [],
    forbidLayers: ['web/domain', 'web/application', 'web/infrastructure', 'web/ui', 'web/app'],
  },
  // src/shared is imported by both sides: no Node builtins, no server/web code.
  shared: {
    forbidPackages: ['node:*', 'fastify', '@fastify/*', 'drizzle-orm', 'better-sqlite3', 'react', 'react-dom', 'react-router'],
    forbidLayers: [
      'server/domain',
      'server/application',
      'server/infrastructure',
      'server/interface',
      'server/composition',
      'web/domain',
      'web/application',
      'web/infrastructure',
      'web/ui',
      'web/shared',
      'web/app',
      'legacy',
    ],
  },
};

export function matchesPackage(spec: string, patterns: string[]): string | null {
  for (const p of patterns) {
    if (p.endsWith('*')) {
      if (spec.startsWith(p.slice(0, -1))) return p;
    } else if (spec === p || spec.startsWith(`${p}/`)) {
      return p;
    }
  }
  return null;
}

export function resolveRelative(fromFile: string, spec: string): string {
  return posix.normalize(posix.join(posix.dirname(fromFile), spec));
}
