import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { User } from '@erp/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../database/prisma.service.js';
import { type AuthenticatedRequest, Public, Roles } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import { createSessionToken, SESSION_COOKIE } from './session-token.js';

const secret = 'test-secret-that-is-at-least-32-characters';
const staff: User = {
  id: 'u1',
  email: 'staff@erp.local',
  name: 'Staff User',
  role: 'STORE_STAFF',
  storeId: 'store-b01',
};
const buyer: User = {
  id: 'u2',
  email: 'buyer@erp.local',
  name: 'Buyer User',
  role: 'PURCHASING',
  storeId: null,
};
const manager: User = {
  id: 'u3',
  email: 'manager@erp.local',
  name: 'Manager User',
  role: 'MANAGER',
  storeId: null,
};
const admin: User = {
  id: 'u4',
  email: 'admin@erp.local',
  name: 'Admin User',
  role: 'ADMIN',
  storeId: null,
};

class RoutesUnderTest {
  @Public()
  open() {}

  closed() {}

  @Roles('ADMIN')
  adminOnly() {}

  @Roles('PURCHASING', 'MANAGER')
  purchasingOrManager() {}

  @Roles('STORE_STAFF')
  staffOnly() {}
}

interface RunOptions {
  cookie?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

function setup(user: User | null) {
  const findUnique = vi.fn().mockResolvedValue(user);
  const guard = new AuthGuard(
    new Reflector(),
    { user: { findUnique } } as unknown as PrismaService,
    { get: () => secret } as unknown as ConfigService<Env, true>,
  );

  function run(route: keyof RoutesUnderTest, options: RunOptions | string = {}) {
    const opts: RunOptions = typeof options === 'string' ? { cookie: options } : options;
    const request = {
      headers: { cookie: opts.cookie },
      params: opts.params ?? {},
      query: opts.query ?? {},
      body: opts.body ?? {},
    } as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => RoutesUnderTest.prototype[route],
      getClass: () => RoutesUnderTest,
    } as unknown as ExecutionContext;
    return { request, result: guard.canActivate(context) };
  }

  return { run, findUnique };
}

const sessionCookie = (userId: string) => `${SESSION_COOKIE}=${createSessionToken(userId, secret)}`;

describe('AuthGuard', () => {
  it('lets anyone call a @Public() route', async () => {
    const { run } = setup(null);

    await expect(run('open').result).resolves.toBe(true);
  });

  it('rejects a protected route without a session', async () => {
    const { run } = setup(staff);

    await expect(run('closed').result).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a tampered cookie', async () => {
    const { run, findUnique } = setup(staff);

    await expect(
      run('closed', `${SESSION_COOKIE}=u1.9999999999999.forged`).result,
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a session whose user no longer exists', async () => {
    const { run } = setup(null);

    await expect(run('closed', sessionCookie('gone')).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the signed-in user to the request', async () => {
    const { run } = setup(staff);
    const { request, result } = run('closed', sessionCookie('u1'));

    await expect(result).resolves.toBe(true);
    expect(request.user).toEqual(staff);
  });

  it('rejects a user without the required role', async () => {
    const { run } = setup(staff);

    await expect(run('adminOnly', sessionCookie('u1')).result).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a user with the required role', async () => {
    const { run } = setup(admin);

    await expect(run('adminOnly', sessionCookie('u4')).result).resolves.toBe(true);
  });

  it('enforces multi-role restrictions correctly', async () => {
    const { run: runBuyer } = setup(buyer);
    await expect(runBuyer('purchasingOrManager', sessionCookie('u2')).result).resolves.toBe(true);

    const { run: runManager } = setup(manager);
    await expect(runManager('purchasingOrManager', sessionCookie('u3')).result).resolves.toBe(true);

    const { run: runStaff } = setup(staff);
    await expect(
      runStaff('purchasingOrManager', sessionCookie('u1')).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects STORE_STAFF missing an assigned storeId', async () => {
    const unassignedStaff: User = { ...staff, storeId: null };
    const { run } = setup(unassignedStaff);

    await expect(run('staffOnly', sessionCookie('u1')).result).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows STORE_STAFF accessing resources within their assigned store', async () => {
    const { run } = setup(staff);

    await expect(
      run('staffOnly', { cookie: sessionCookie('u1'), params: { storeId: 'store-b01' } }).result,
    ).resolves.toBe(true);

    await expect(
      run('staffOnly', { cookie: sessionCookie('u1'), query: { storeId: 'store-b01' } }).result,
    ).resolves.toBe(true);

    await expect(
      run('staffOnly', { cookie: sessionCookie('u1'), body: { storeId: 'store-b01' } }).result,
    ).resolves.toBe(true);
  });

  it('rejects STORE_STAFF attempting to access resources of another store (NFR-01)', async () => {
    const { run } = setup(staff);

    await expect(
      run('staffOnly', { cookie: sessionCookie('u1'), params: { storeId: 'store-b02' } }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      run('staffOnly', { cookie: sessionCookie('u1'), query: { storeId: 'store-b02' } }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      run('staffOnly', { cookie: sessionCookie('u1'), body: { storeId: 'store-b02' } }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows organization-wide roles to access resources across any store', async () => {
    const { run: runAdmin } = setup(admin);
    await expect(
      runAdmin('closed', { cookie: sessionCookie('u4'), params: { storeId: 'store-b02' } }).result,
    ).resolves.toBe(true);

    const { run: runManager } = setup(manager);
    await expect(
      runManager('closed', { cookie: sessionCookie('u3'), params: { storeId: 'store-b02' } })
        .result,
    ).resolves.toBe(true);

    const { run: runBuyer } = setup(buyer);
    await expect(
      runBuyer('closed', { cookie: sessionCookie('u2'), params: { storeId: 'store-b02' } }).result,
    ).resolves.toBe(true);
  });
});
