import { describe, expect, it } from 'vitest';
import type { AdminAuthGateway } from './admin-auth-gateway.js';
import { createAdminAuthLoaders } from './admin-auth-loaders.js';

const gw = (loggedIn: boolean, setupDone = true) => ({ getStatus: async () => ({ loggedIn, setupDone }) }) as unknown as AdminAuthGateway;
const redirectTarget = async (p: Promise<unknown>) => { try { await p; return null; } catch (r) { return (r as Response).headers.get('Location'); } };

describe('admin auth loaders', () => {
  it('requireLogin lets a logged-in mentor through and sends everyone else to the login page', async () => {
    expect(await redirectTarget(createAdminAuthLoaders(gw(true)).requireLogin())).toBeNull();
    expect(await redirectTarget(createAdminAuthLoaders(gw(false)).requireLogin())).toBe('/admin/login');
  });
  it('the login page skips ahead when already logged in, else shows the status (setup or login)', async () => {
    expect(await redirectTarget(createAdminAuthLoaders(gw(true)).login())).toBe('/admin/exams');
    expect(await createAdminAuthLoaders(gw(false, false)).login()).toEqual({ loggedIn: false, setupDone: false });
  });
});
