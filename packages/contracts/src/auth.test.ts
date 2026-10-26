import { describe, expect, it } from 'vitest';
import { LoginInputSchema, RoleSchema, SessionSchema, UserSchema } from './auth.js';

describe('RoleSchema', () => {
  it('accepts the four required roles', () => {
    expect(RoleSchema.safeParse('ADMIN').success).toBe(true);
    expect(RoleSchema.safeParse('PURCHASING').success).toBe(true);
    expect(RoleSchema.safeParse('STORE_STAFF').success).toBe(true);
    expect(RoleSchema.safeParse('MANAGER').success).toBe(true);
  });

  it('rejects obsolete or unknown roles', () => {
    expect(RoleSchema.safeParse('STAFF').success).toBe(false);
    expect(RoleSchema.safeParse('OWNER').success).toBe(false);
  });
});

describe('UserSchema', () => {
  it('accepts STORE_STAFF with mandatory storeId', () => {
    const result = UserSchema.safeParse({
      id: 'user-1',
      email: 'staff@erp.local',
      name: 'Store Staff',
      role: 'STORE_STAFF',
      storeId: 'store-1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects STORE_STAFF without storeId', () => {
    const result = UserSchema.safeParse({
      id: 'user-1',
      email: 'staff@erp.local',
      name: 'Store Staff',
      role: 'STORE_STAFF',
      storeId: null,
    });

    expect(result.success).toBe(false);
  });

  it('accepts organization-wide roles with null storeId', () => {
    const admin = UserSchema.safeParse({
      id: 'admin-1',
      email: 'admin@erp.local',
      name: 'Admin',
      role: 'ADMIN',
      storeId: null,
    });
    const purchasing = UserSchema.safeParse({
      id: 'buyer-1',
      email: 'buyer@erp.local',
      name: 'Purchasing Officer',
      role: 'PURCHASING',
      storeId: null,
    });
    const manager = UserSchema.safeParse({
      id: 'manager-1',
      email: 'manager@erp.local',
      name: 'Manager',
      role: 'MANAGER',
      storeId: null,
    });

    expect(admin.success).toBe(true);
    expect(purchasing.success).toBe(true);
    expect(manager.success).toBe(true);
  });

  it('rejects organization-wide roles with non-null storeId', () => {
    const result = UserSchema.safeParse({
      id: 'admin-1',
      email: 'admin@erp.local',
      name: 'Admin',
      role: 'ADMIN',
      storeId: 'store-1',
    });

    expect(result.success).toBe(false);
  });
});

describe('LoginInputSchema', () => {
  it('accepts an email and password', () => {
    const result = LoginInputSchema.safeParse({ email: 'admin@erp.local', password: 'password' });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = LoginInputSchema.safeParse({ email: 'admin', password: 'password' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = LoginInputSchema.safeParse({ email: 'admin@erp.local', password: '' });

    expect(result.success).toBe(false);
  });
});

describe('SessionSchema', () => {
  it('accepts a signed-out session', () => {
    expect(SessionSchema.safeParse({ user: null }).success).toBe(true);
  });

  it('rejects an unknown role', () => {
    const result = SessionSchema.safeParse({
      user: { id: '1', email: 'a@erp.local', name: 'A', role: 'OWNER' },
    });

    expect(result.success).toBe(false);
  });
});
