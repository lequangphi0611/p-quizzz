import { beforeEach, describe, expect, it } from 'vitest';
import { possibleSecret } from './possible-secret.js';
import { ctx, prompt, resetEvents, tool } from './test-events.js';

beforeEach(resetEvents);

describe('possibleSecret', () => {
  it('goes up for keys and passwords in a prompt, a command, an edit or an output', () => {
    const a = prompt('đây là key: sk-abcdefghijklmnopqrstuvwx');
    const b = tool('Bash', 'curl -H "password=hunter22222" x');
    const c = tool('Write', '.env', true, { changeText: 'API_KEY=abcd1234efgh' });
    const d = tool('Bash', 'printenv', true, { outputText: 'AWS=AKIAABCDEFGHIJKLMNOP' });
    expect(possibleSecret([a, b, c, d], ctx())?.eventIds).toEqual([a.id, b.id, c.id, d.id]);
  });
  it('stays down for ordinary text', () => {
    expect(possibleSecret([prompt('viết hàm cộng'), tool('Bash', 'npm test', true, { outputText: 'Tests: 3 passed' }), prompt('token = x')], ctx())).toBeNull();
  });
});
