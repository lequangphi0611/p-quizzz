import { describe, expect, it } from 'vitest';
import { isVerifyCommand } from './is-verify-command.js';

describe('isVerifyCommand', () => {
  it.each([
    'npm test', 'npm run build', 'npm run test:unit', 'pnpm lint', 'yarn test', 'npm t', 'npx vitest', 'npx vitest run src/a.test.ts',
    'pytest', 'pytest -q tests/', 'python -m pytest', 'go test ./...', 'go vet ./...', 'cargo test', 'cargo build --release', 'mvn test', './mvnw verify',
    'gradle build', './gradlew test', '.\\gradlew.bat build', 'dotnet test', 'dotnet build', 'tsc --noEmit', 'npx tsc -p .', 'eslint src', 'make test',
    'cd app && npm test', 'CI=1 npm test', 'npm run typecheck && echo ok', 'Invoke-Pester', '$env:CI = 1; npm test', 'npm run check', 'node --test',
  ])('recognises %s', command => expect(isVerifyCommand(command)).toBe(true));

  it.each([
    'ls', 'ls -la', 'cat README.md', 'cat tsc.log', 'git status', 'git diff', 'npm install', 'npm start', 'npm run dev', 'echo test', 'grep -r build src',
    'cd tests', 'mkdir build', 'rm -rf build', 'node index.js', 'python main.py', 'Get-ChildItem', '',
  ])('does not recognise %s', command => expect(isVerifyCommand(command)).toBe(false));
});
