const SCRIPT = String.raw`(?:test|tests|build|lint|check|typecheck|type-check|e2e|verify|compile)(?::[\w:-]+)?`;

/** Each pattern is matched at the start of one command (after env vars, `sudo`, `npx`), so `cat tsc.log` is not a check. */
const VERIFY: readonly RegExp[] = [
  new RegExp(String.raw`^(?:npm|pnpm|yarn|bun)\s+(?:(?:run|run-script|exec)\s+)?(?:-{1,2}[\w-]+\s+)*(?:t|${SCRIPT})\b`),
  /^(?:vitest|jest|mocha|ava|tap|eslint|tsc|biome|prettier\s+(?:--check|-c)|playwright\s+test|cypress\s+run|stylelint)\b/,
  /^(?:pytest|py\.test|tox|nox|ruff|mypy|flake8|pylint|pyright|black\s+--check|phpunit|rspec|ctest|invoke-pester|pester)\b/i,
  /^(?:python3?|py)\s+-m\s+(?:pytest|unittest|mypy|ruff|flake8|pylint)\b/,
  /^go\s+(?:test|vet|build)\b/,
  /^cargo\s+(?:test|build|check|clippy|nextest)\b/,
  /^(?:\.[\\/])?(?:mvnw?(?:\.cmd)?|gradlew?(?:\.bat)?)\s.*\b(?:test|verify|build|check|package|compile)\b/,
  /^dotnet\s+(?:test|build)\b/,
  /^(?:make|just|task)\s+(?:test|check|build|lint|verify)\b/,
  /^(?:node|deno|bun)\s+(?:--test|test)\b/,
];

const PREFIX = /^(?:(?:sudo|time|command|call)\s+|[A-Za-z_][A-Za-z0-9_]*=\S*\s+|\$env:\w+\s*=\s*\S+\s*;\s*|npx\s+(?:-{1,2}[\w-]+\s+)*|pnpm\s+dlx\s+|(?:\.[\\/]|node_modules[\\/]\.bin[\\/]))+/i;

/**
 * Does this shell command run the project's own checks: tests, build, lint, type check? Recognised by common shapes (no
 * per-training setup, PRODUCT.md §7.35c); the commands may be chained (`cd app && npm test`), and PowerShell spells the same tools.
 */
export function isVerifyCommand(command: string): boolean {
  return command
    .split(/&&|\|\||;|\||\r?\n/)
    .map(part => part.trim().replace(PREFIX, ''))
    .some(part => part !== '' && VERIFY.some(p => p.test(part)));
}
