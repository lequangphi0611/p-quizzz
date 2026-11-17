import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { RULES, classify, matchesPackage, resolveRelative } from './rules.js';

export interface SourceFile {
  /** Repo-relative path with forward slashes, e.g. `src/server/domain/exam.ts`. */
  path: string;
  source: string;
}

export interface Violation {
  file: string;
  line: number;
  spec: string;
  message: string;
}

export interface CheckResult {
  violations: Violation[];
  /** Allowlist entries that match no file; remove them so the list only shrinks. */
  staleAllowlist: string[];
}

const IMPORT_RES = [
  /(?:^|\n)[ \t]*(?:import|export)[ \t][^'"`;]*?\bfrom[ \t]*['"]([^'"]+)['"]/g,
  /(?:^|\n)[ \t]*import[ \t]*['"]([^'"]+)['"]/g,
  /\bimport\([ \t]*['"]([^'"]+)['"][ \t]*\)/g,
];

export function extractImports(source: string): { spec: string; line: number }[] {
  const out: { spec: string; line: number }[] = [];
  for (const re of IMPORT_RES) {
    for (const m of source.matchAll(re)) {
      const spec = m[1]!;
      const at = m.index! + m[0].lastIndexOf(spec);
      out.push({ spec, line: source.slice(0, at).split('\n').length });
    }
  }
  return out;
}

/** Test code: `*.test.ts(x)` and anything under a `testing/` or `test/` folder. Production code must not import it. */
function isTestCode(path: string): boolean {
  return /\.test\.tsx?$/.test(path) || /\/(testing|test)\//.test(path);
}

function isAllowlisted(path: string, allowlist: string[]): boolean {
  return allowlist.some(e => (e.endsWith('/') ? path.startsWith(e) : path === e));
}

export function checkArchitecture(files: SourceFile[], allowlist: string[]): CheckResult {
  const violations: Violation[] = [];

  for (const file of files) {
    const from = classify(file.path);
    if (from.layer === 'legacy') {
      if (!isAllowlisted(file.path, allowlist)) {
        violations.push({
          file: file.path,
          line: 1,
          spec: '',
          message: 'File is outside every layer and not in the legacy allowlist (scripts/arch/allowlist.ts). Put it in a layer from docs/architecture.md §9.',
        });
      }
      continue;
    }
    if (isAllowlisted(file.path, allowlist)) continue;

    // Every layer, composition root included: test fakes are for tests (a fake wired into production hides a missing adapter).
    if (!isTestCode(file.path)) {
      for (const { spec, line } of extractImports(file.source)) {
        if (spec.startsWith('.') && /(^|\/)testing\//.test(resolveRelative(file.path, spec))) {
          violations.push({ file: file.path, line, spec, message: 'production code must not import test fakes from a testing/ folder (put the real adapter in infrastructure/)' });
        }
      }
    }

    const rule = RULES[from.layer];
    if (!rule) continue;

    for (const { spec, line } of extractImports(file.source)) {
      if (!spec.startsWith('.')) {
        const hit = matchesPackage(spec, rule.forbidPackages);
        if (hit) {
          violations.push({ file: file.path, line, spec, message: `${from.layer} must not import package "${hit}"` });
        }
        continue;
      }
      const target = classify(resolveRelative(file.path, spec));
      if (rule.forbidLayers.includes(target.layer)) {
        violations.push({ file: file.path, line, spec, message: `${from.layer} must not import ${target.layer}` });
      } else if (rule.sameFeatureOnly && target.feature && target.feature !== from.feature) {
        violations.push({
          file: file.path,
          line,
          spec,
          message: `feature "${from.feature}" must not import internals of feature "${target.feature}" (go through src/web/shared)`,
        });
      }
    }
  }

  const staleAllowlist = allowlist.filter(e => !files.some(f => (e.endsWith('/') ? f.path.startsWith(e) : f.path === e)));
  return { violations, staleAllowlist };
}

const SOURCE_RE = /\.(ts|tsx)$/;

export function collectSourceFiles(root: string, dir = 'src'): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (abs: string) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const full = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
      } else if (SOURCE_RE.test(entry.name)) {
        out.push({ path: relative(root, full).split(sep).join('/'), source: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(join(root, dir));
  return out;
}
