import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
import { UserMenu } from './user-menu';

function renderUserMenu() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <UserMenu />
    </QueryClientProvider>,
  );
}

describe('UserMenu', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders STORE_STAFF with Thai role label and assigned store', async () => {
    mockApi({
      'GET /auth/me': {
        user: {
          id: 'u1',
          email: 'staff_b01@erp.local',
          name: 'Somchai Jaidee',
          role: 'STORE_STAFF',
          storeId: 'B01',
        },
      },
    });

    renderUserMenu();

    expect(await screen.findByText('Somchai Jaidee')).toBeInTheDocument();
    expect(screen.getByText('พนักงานประจำสาขา')).toBeInTheDocument();
    expect(screen.getByText(/B01/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ออกจากระบบ/i })).toBeInTheDocument();
  });

  it('renders ADMIN with Thai role label and organization-wide store status', async () => {
    mockApi({
      'GET /auth/me': {
        user: {
          id: 'u2',
          email: 'admin@erp.local',
          name: 'Admin User',
          role: 'ADMIN',
          storeId: null,
        },
      },
    });

    renderUserMenu();

    expect(await screen.findByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('ผู้ดูแลระบบ')).toBeInTheDocument();
    expect(screen.getByText(/ส่วนกลาง|ทุกสาขา/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ออกจากระบบ/i })).toBeInTheDocument();
  });

  it('renders PURCHASING and MANAGER Thai role labels', async () => {
    mockApi({
      'GET /auth/me': {
        user: {
          id: 'u3',
          email: 'manager@erp.local',
          name: 'Manager User',
          role: 'MANAGER',
          storeId: null,
        },
      },
    });

    renderUserMenu();

    expect(await screen.findByText('Manager User')).toBeInTheDocument();
    expect(screen.getByText('ผู้จัดการ')).toBeInTheDocument();
  });
});
