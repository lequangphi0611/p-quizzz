import { describe, expect, it } from 'vitest';
import { AdminAlreadySetupError, InvalidCredentialsError } from '../../../domain/auth/errors.js';
import { FakeTokenGenerator } from '../../testing/fakes.js';
import { FakePasswordHasher, InMemoryAdminCredentialStore, InMemoryAdminSessionStore } from '../../testing/fake-admin-auth.js';
import { AuthenticateAdmin, GetAdminStatus, LoginAdmin, LogoutAdmin, SetupAdmin } from './admin-use-cases.js';

function build() {
  const deps = { credentials: new InMemoryAdminCredentialStore(), sessions: new InMemoryAdminSessionStore(), hasher: new FakePasswordHasher(), tokens: new FakeTokenGenerator() };
  return {
    deps,
    status: new GetAdminStatus(deps),
    setup: new SetupAdmin(deps),
    login: new LoginAdmin(deps),
    logout: new LogoutAdmin(deps.sessions),
    authenticate: new AuthenticateAdmin(deps.sessions),
  };
}

describe('mentor auth use cases', () => {
  it('setup → logged in → logout → login again', async () => {
    const a = build();
    expect(await a.status.execute(undefined)).toEqual({ setupDone: false, loggedIn: false });
    const token = await a.setup.execute('secret1');
    expect(await a.status.execute(token)).toEqual({ setupDone: true, loggedIn: true });
    expect(a.authenticate.execute(token)).toBe(true);
    a.logout.execute(token);
    expect(await a.status.execute(token)).toEqual({ setupDone: true, loggedIn: false });
    const again = await a.login.execute('secret1');
    expect(again).not.toBe(token);
    expect(a.authenticate.execute(again)).toBe(true);
  });

  it('setup works once only', async () => {
    const a = build();
    await a.setup.execute('secret1');
    await expect(a.setup.execute('other')).rejects.toBeInstanceOf(AdminAlreadySetupError);
    expect(await a.deps.credentials.get()).toBe('hashed:secret1');
  });

  it('two concurrent setups cannot both win, even though hashing awaits in between', async () => {
    const a = build();
    const results = await Promise.allSettled([a.setup.execute('one111'), a.setup.execute('two222')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(AdminAlreadySetupError);
  });

  it('a wrong password and a missing setup give the same error and no token', async () => {
    const a = build();
    await expect(a.login.execute('x')).rejects.toBeInstanceOf(InvalidCredentialsError); // not set up yet
    await a.setup.execute('secret1');
    const err = await a.login.execute('wrong').catch(e => e);
    expect(err).toBeInstanceOf(InvalidCredentialsError);
    expect(err.message).toBe('Sai mật khẩu');
    expect(a.authenticate.execute(undefined)).toBe(false);
    expect(a.authenticate.execute('made-up')).toBe(false);
  });
});
