import { beforeEach, describe, expect, it } from 'vitest';
import { isTestPath, touchesTests } from './touches-tests.js';
import { ctx, resetEvents, tool } from './test-events.js';

beforeEach(resetEvents);
const edit = (path: string, changeText: string) => tool('Edit', path, true, { changeText });

describe('isTestPath', () => {
  it.each(['src/add.test.ts', 'a/b.spec.js', 'tests/x.py', 'pkg/add_test.go', 'test_add.py', 'src/__tests__/a.ts', 'src/AddTest.java'])('%s', p => expect(isTestPath(p)).toBe(true));
  it.each(['src/add.ts', 'src/latest.ts', 'docs/contest.md'])('%s is not', p => expect(isTestPath(p)).toBe(false));
});

describe('touchesTests', () => {
  it('goes up when a skip is added to a test file', () => {
    const e = edit('src/add.test.ts', "- it('adds', () => {\n+ it.skip('adds', () => {");
    expect(touchesTests([e], ctx())).toEqual({ code: 'touches_tests', eventIds: [e.id] });
  });
  it('goes up when test cases are removed, or the test file is deleted', () => {
    const removed = edit('tests/test_add.py', '- def test_add():\n-     assert add(1, 2) == 3');
    const rm = tool('Bash', 'rm src/add.test.ts');
    expect(touchesTests([removed, rm], ctx())?.eventIds).toEqual([removed.id, rm.id]);
  });
  it('stays down for editing the body of a test, for non-test files, and for a skip that was already there', () => {
    expect(touchesTests([edit('src/add.test.ts', '- expect(add(1, 2)).toBe(4)\n+ expect(add(1, 2)).toBe(3)')], ctx())).toBeNull();
    expect(touchesTests([edit('src/add.ts', '+ it.skip(')], ctx())).toBeNull();
    expect(touchesTests([edit('src/add.test.ts', '- it.skip("a", f)\n+ it.skip("b", f)')], ctx())).toBeNull();
    expect(touchesTests([edit('src/add.test.ts', "- it('a', f)\n+ it('b', f)")], ctx())).toBeNull();
  });
});
