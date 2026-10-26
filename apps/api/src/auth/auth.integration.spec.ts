import { Controller, Get, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@erp/contracts';
import { hashPassword } from '@erp/database';
import { call } from '@orpc/server';
import type { Response } from 'express';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { AuthController } from './auth.controller.js';
import { CurrentUser, Public, Roles } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import { SESSION_COOKIE, verifySessionToken } from './session-token.js';

const secret = 'test-secret-at-least-32-characters-long';

@Controller('test')
class TestResourceController {
  @Public()
  @Get('public')
  publicEndpoint() {
    return { ok: true };
  }

  @Roles('ADMIN')
  @Get('admin-only')
  adminOnly() {
    return { ok: true };
  }

  @Roles('STORE_STAFF')
  @Get('store/:storeId')
  storeScopedStaff(@Param('storeId') _storeId: string) {
    return { ok: true };
  }

  @Get('store-query')
  storeScopedQuery(@Query('storeId') _storeId: string) {
    return { ok: true };
  }
}

describe('Auth & Store-Scoped Access Integration', () => {
  let moduleRef: TestingModule;
  let authController: AuthController;
  let guard: AuthGuard;
  let passwordHash: string;

  const users: Record<string, User & { passwordHash: string }> = {};

  beforeAll(async () => {
    passwordHash = await hashPassword('password');

    users['admin@erp.local'] = {
      id: 'admin-1',
      email: 'admin@erp.local',
      name: 'Admin User',
      role: 'ADMIN',
      storeId: null,
      passwordHash,
    };
    users['staff_b01@erp.local'] = {
      id: 'staff-1',
      email: 'staff_b01@erp.local',
      name: 'Staff B01',
      role: 'STORE_STAFF',
      storeId: 'B01',
      passwordHash,
    };
    users['staff_b02@erp.local'] = {
      id: 'staff-2',
      email: 'staff_b02@erp.local',
      name: 'Staff B02',
      role: 'STORE_STAFF',
      storeId: 'B02',
      passwordHash,
    };

    moduleRef = await Test.createTestingModule({
      controllers: [AuthController, TestResourceController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: vi.fn().mockImplementation(({ where }: { where: { email?: string; id?: string } }) => {
                if (where.email) return users[where.email] ?? null;
                if (where.id) return Object.values(users).find((u) => u.id === where.id) ?? null;
                return null;
              }),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'AUTH_SECRET' ? secret : 'test'),
          },
        },
        {
          provide: APP_GUARD,
          useClass: AuthGuard,
        },
        AuthGuard,
      ],
    }).compile();

    authController = moduleRef.get(AuthController);
    guard = moduleRef.get(AuthGuard);
  });

  function fakeResponse() {
    let cookieName = '';
    let cookieVal = '';
    return {
      cookie: vi.fn((name, val) => {
        cookieName = name;
        cookieVal = val;
      }),
      clearCookie: vi.fn(),
      get cookieHeader() {
        return `${cookieName}=${cookieVal}`;
      },
    } as unknown as Response & { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn>; cookieHeader: string };
  }

  it('valid login issues session token and returns user details with storeId', async () => {
    const res = fakeResponse();
    const loginResult = await call(authController.login(res), {
      email: 'staff_b01@erp.local',
      password: 'password',
    });

    expect(loginResult).toEqual({
      id: 'staff-1',
      email: 'staff_b01@erp.local',
      name: 'Staff B01',
      role: 'STORE_STAFF',
      storeId: 'B01',
    });

    expect(res.cookie).toHaveBeenCalled();
    const [cookieName, token] = res.cookie.mock.calls[0]!;
    expect(cookieName).toBe(SESSION_COOKIE);
    expect(verifySessionToken(token, secret)).toBe('staff-1');
  });

  it('rejects invalid login without issuing token', async () => {
    const res = fakeResponse();
    await expect(
      call(authController.login(res), {
        email: 'staff_b01@erp.local',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('verifies role checks: ADMIN allowed on admin-only route, STAFF rejected', async () => {
    const resAdmin = fakeResponse();
    await call(authController.login(resAdmin), { email: 'admin@erp.local', password: 'password' });

    const adminContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { cookie: resAdmin.cookieHeader },
          params: {},
          query: {},
        }),
      }),
      getHandler: () => TestResourceController.prototype.adminOnly,
      getClass: () => TestResourceController,
    } as any;

    await expect(guard.canActivate(adminContext)).resolves.toBe(true);

    const resStaff = fakeResponse();
    await call(authController.login(resStaff), { email: 'staff_b01@erp.local', password: 'password' });

    const staffContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { cookie: resStaff.cookieHeader },
          params: {},
          query: {},
        }),
      }),
      getHandler: () => TestResourceController.prototype.adminOnly,
      getClass: () => TestResourceController,
    } as any;

    await expect(guard.canActivate(staffContext)).rejects.toThrow();
  });

  it('verifies store-scoping: staff_b01 can access B01 but is rejected with 403 on B02 (NFR-01, AC-04)', async () => {
    const resStaff = fakeResponse();
    await call(authController.login(resStaff), { email: 'staff_b01@erp.local', password: 'password' });

    // Access assigned store B01 -> Allowed
    const allowedContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { cookie: resStaff.cookieHeader },
          params: { storeId: 'B01' },
          query: {},
        }),
      }),
      getHandler: () => TestResourceController.prototype.storeScopedStaff,
      getClass: () => TestResourceController,
    } as any;

    await expect(guard.canActivate(allowedContext)).resolves.toBe(true);

    // Access other store B02 -> Rejected with 403 Forbidden
    const rejectedContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { cookie: resStaff.cookieHeader },
          params: { storeId: 'B02' },
          query: {},
        }),
      }),
      getHandler: () => TestResourceController.prototype.storeScopedStaff,
      getClass: () => TestResourceController,
    } as any;

    await expect(guard.canActivate(rejectedContext)).rejects.toThrow();
  });
});
