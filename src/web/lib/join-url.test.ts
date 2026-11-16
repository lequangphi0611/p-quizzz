import { describe, expect, it } from 'vitest';
import { isLocalHostname, pickJoinHost } from './join-url.js';

describe('pickJoinHost', () => {
  it('a real address in the browser is already what members need', () => {
    expect(pickJoinHost({ host: '192.168.1.24:3000', hostname: '192.168.1.24' }, ['10.0.0.1:3000'])).toEqual({ host: '192.168.1.24:3000', unreachable: false });
  });
  it('localhost → the first LAN address from the server', () => {
    expect(pickJoinHost({ host: 'localhost:5173', hostname: 'localhost' }, ['192.168.1.24:5173', '10.0.0.7:5173'])).toEqual({ host: '192.168.1.24:5173', unreachable: false });
  });
  it('localhost and no LAN address known → shows localhost but flags it unusable', () => {
    expect(pickJoinHost({ host: 'localhost:3000', hostname: 'localhost' }, [])).toEqual({ host: 'localhost:3000', unreachable: true });
  });
});

describe('isLocalHostname', () => {
  it('recognises loopback names', () => {
    for (const h of ['localhost', '127.0.0.1', '127.1.2.3', '::1', '[::1]']) expect(isLocalHostname(h), h).toBe(true);
    for (const h of ['192.168.1.2', 'example.com', 'localhost.example.com']) expect(isLocalHostname(h), h).toBe(false);
  });
});
