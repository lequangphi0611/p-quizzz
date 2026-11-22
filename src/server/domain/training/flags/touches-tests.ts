import { cap, isShell, type FlagEvent, type FlagRule } from './flag-event.js';

const TEST_PATH = /(?:^|[\\/])(?:tests?|__tests__|spec|e2e)[\\/]|\.(?:test|spec)\.[a-z]+$|_test\.(?:go|py|rb)$|(?:^|[\\/])test_[^\\/]*\.py$|(?:Test|Tests|IT)\.(?:java|kt|cs)$/i;
const SKIP = /\.(?:skip|todo)\s*\(|\b(?:xit|xdescribe|xtest)\s*\(|@Ignore\b|@Disabled\b|pytest\.mark\.(?:skip|xfail)|\bt\.Skip\w*\(|\[Ignore\]|\[Fact\(Skip/;
const CASE = /\b(?:it|test)\s*\(|^\s*def\s+test_|\bfunc\s+Test\w+|@Test\b|\[Fact\]|\[Test\]/;
const DELETE_TEST_FILE = /\b(?:rm|git\s+rm|del|erase|Remove-Item)\b[^|;&]*(?:\.(?:test|spec)\.[a-z]+|_test\.(?:go|py)|[\\/]tests?[\\/]|test_\w+\.py)/i;

export const isTestPath = (path: string): boolean => TEST_PATH.test(path);

const lines = (text: string, mark: '+' | '-') => text.split('\n').filter(l => l.startsWith(`${mark} `)).map(l => l.slice(2));

function editTouches(e: FlagEvent): boolean {
  if (e.kind !== 'tool' || e.ok !== true || !e.toolTarget || !isTestPath(e.toolTarget) || !e.changeText) return false;
  const added = lines(e.changeText, '+');
  const removed = lines(e.changeText, '-');
  if (added.some(l => SKIP.test(l)) && !removed.some(l => SKIP.test(l))) return true;
  return removed.filter(l => CASE.test(l)).length > added.filter(l => CASE.test(l)).length;
}

/** "Đụng vào test": a skip added to a test file, test cases removed from it, or a test file deleted from the shell. */
export const touchesTests: FlagRule = events => {
  const ids = events.filter(e => editTouches(e) || (isShell(e) && e.toolTarget !== null && DELETE_TEST_FILE.test(e.toolTarget))).map(e => e.id);
  return ids.length > 0 ? { code: 'touches_tests', eventIds: cap(ids) } : null;
};
