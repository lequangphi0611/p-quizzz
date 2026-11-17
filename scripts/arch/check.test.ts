import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEGACY_ALLOWLIST } from './allowlist.js';
import { checkArchitecture, collectSourceFiles, extractImports, type SourceFile } from './check.js';

const f = (path: string, source: string): SourceFile => ({ path, source });
const msgs = (files: SourceFile[], allow: string[] = []) =>
  checkArchitecture(files, allow).violations.map(v => v.message);

describe('extractImports', () => {
  it('finds static, type, multi-line, re-export, side-effect and dynamic imports with line numbers', () => {
    const src = [
      "import a from 'pkg-a';",
      "import type { B } from './b.js';",
      'import {',
      '  c,',
      "} from '../c.js';",
      "export * from './d.js';",
      "import './e.css';",
      "const x = await import('./f.js');",
      "// import nope from 'commented';",
    ].join('\n');
    expect(extractImports(src)).toEqual(
      expect.arrayContaining([
        { spec: 'pkg-a', line: 1 },
        { spec: './b.js', line: 2 },
        { spec: '../c.js', line: 5 },
        { spec: './d.js', line: 6 },
        { spec: './e.css', line: 7 },
        { spec: './f.js', line: 8 },
      ]),
    );
    expect(extractImports(src).some(i => i.spec === 'commented')).toBe(false);
  });
});

describe('server layer rules catch violations', () => {
  it.each([
    ['domain -> fastify', f('src/server/domain/a.ts', "import Fastify from 'fastify';")],
    ['domain -> drizzle subpath', f('src/server/domain/a.ts', "import { x } from 'drizzle-orm/sqlite-core';")],
    ['domain -> better-sqlite3', f('src/server/domain/a.ts', "import D from 'better-sqlite3';")],
    ['domain -> application', f('src/server/domain/a.ts', "import { U } from '../application/use-cases/u.js';")],
    ['domain -> infrastructure', f('src/server/domain/a.ts', "import { R } from '../infrastructure/db/r.js';")],
    ['domain -> legacy services', f('src/server/domain/a.ts', "import { s } from '../services/sessions.js';")],
    ['application -> infrastructure', f('src/server/application/use-cases/x/a.ts', "import { R } from '../../../infrastructure/db/r.js';")],
    ['application -> interface', f('src/server/application/a.ts', "import { r } from '../interface/http/r.js';")],
    ['application -> drizzle-orm', f('src/server/application/a.ts', "import { eq } from 'drizzle-orm';")],
    ['interface -> infrastructure', f('src/server/interface/http/a.ts', "import { R } from '../../infrastructure/db/r.js';")],
    ['infrastructure -> interface', f('src/server/infrastructure/a.ts', "import { r } from '../interface/http/r.js';")],
  ])('%s', (_name, file) => {
    expect(msgs([file])).toHaveLength(1);
  });

  it('allows the documented directions and composition.ts wiring', () => {
    expect(
      msgs([
        f('src/server/application/a.ts', "import { E } from '../domain/e.js'; import { z } from 'zod';"),
        f('src/server/infrastructure/db/r.ts', "import { eq } from 'drizzle-orm'; import { P } from '../../application/ports/p.js';"),
        f('src/server/interface/http/r.ts', "import Fastify from 'fastify'; import { U } from '../../application/use-cases/u.js';"),
        f('src/server/composition.ts', "import { R } from './infrastructure/db/r.js'; import { r } from './interface/http/r.js';"),
      ]),
    ).toEqual([]);
  });
});

describe('composition is matched through the .js import specifier', () => {
  it('interface importing ./composition.js is a violation', () => {
    expect(msgs([f('src/server/interface/http/a.ts', "import { compose } from '../../composition.js';")])).toHaveLength(1);
  });
});

describe('wiring shell', () => {
  it('app.ts, index.ts, config.ts and the test harness may see every layer; interface may not import them', () => {
    expect(
      msgs([
        f('src/server/app.ts', "import { R } from './infrastructure/db/r.js'; import { c } from './composition.js';"),
        f('src/server/index.ts', "import { R } from './infrastructure/db/r.js';"),
        f('src/server/test/helpers.ts', "import { R } from '../infrastructure/db/r.js'; import { a } from '../app.js';"),
      ]),
    ).toEqual([]);
    expect(msgs([f('src/server/interface/http/a.ts', "import { config } from '../../config.js';")])).toHaveLength(1);
    expect(msgs([f('src/server/application/a.ts', "import { buildApp } from '../app.js';")])).toHaveLength(1);
  });
});

describe('web layer rules catch violations', () => {
  const p = (feat: string, layer: string, name = 'a.ts') => `src/web/features/${feat}/${layer}/${name}`;
  it.each([
    ['domain -> react', f(p('x', 'domain'), "import { useState } from 'react';")],
    ['ui -> infrastructure', f(p('x', 'ui', 'a.tsx'), "import { api } from '../infrastructure/api.js';")],
    ['application -> ui', f(p('x', 'application'), "import { P } from '../ui/P.js';")],
    ['feature -> other feature internals', f(p('x', 'ui', 'a.tsx'), "import { y } from '../../y/application/y.js';")],
    ['shared -> feature', f('src/web/shared/a.ts', "import { y } from '../features/y/domain/y.js';")],
  ])('%s', (_name, file) => {
    expect(msgs([file])).toHaveLength(1);
  });

  it('allows ui -> application and cross-feature use through shared', () => {
    expect(
      msgs([
        f(p('x', 'ui', 'a.tsx'), "import { useX } from '../application/useX.js'; import { Button } from '../../../shared/ui/Button.js'; import { useState } from 'react';"),
        f(p('x', 'infrastructure'), "import { Port } from '../application/ports.js';"),
      ]),
    ).toEqual([]);
  });
});

describe('src/shared rules', () => {
  it('rejects Node builtins and server/web imports', () => {
    expect(msgs([f('src/shared/a.ts', "import { readFileSync } from 'node:fs';")])).toHaveLength(1);
    expect(msgs([f('src/shared/a.ts', "import { x } from '../server/domain/x.js';")])).toHaveLength(1);
    expect(msgs([f('src/shared/a.ts', "import { x } from '../web/features/a/domain/x.js';")])).toHaveLength(1);
  });
});

describe('allowlist', () => {
  it('flags unclassified files that are not allowlisted', () => {
    expect(msgs([f('src/server/services/new.ts', 'export {};')])).toHaveLength(1);
    expect(msgs([f('src/server/services/new.ts', 'export {};')], ['src/server/services/'])).toEqual([]);
  });

  it('exempts allowlisted layered files from rules', () => {
    const file = f('src/server/domain/a.ts', "import Fastify from 'fastify';");
    expect(msgs([file], ['src/server/domain/a.ts'])).toEqual([]);
  });

  it('reports stale entries', () => {
    const r = checkArchitecture([f('src/server/domain/a.ts', 'export {};')], ['src/server/gone/', 'src/server/domain/a.ts']);
    expect(r.staleAllowlist).toEqual(['src/server/gone/']);
  });
});

describe('repository', () => {
  it('current source passes with the legacy allowlist', () => {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    const r = checkArchitecture(collectSourceFiles(root), LEGACY_ALLOWLIST);
    expect(r.violations).toEqual([]);
    expect(r.staleAllowlist).toEqual([]);
  });
});

describe('production code must not use test fakes', () => {
  it('flags an import of a testing/ folder from production code but not from tests', () => {
    const prod = f('src/server/composition.ts', "import { X } from './application/testing/fakes.js';");
    const test = f('src/server/application/use-cases/a.test.ts', "import { X } from '../testing/fakes.js';");
    expect(msgs([prod])).toEqual([expect.stringContaining('test fakes')]);
    expect(msgs([test])).toEqual([]);
  });
});
