import { createPrismaClient, hashPassword, Role } from '../src/index.js';

const prisma = createPrismaClient(
  process.env.DATABASE_URL ?? 'postgresql://erp:erp@localhost:5432/erp',
);

// Demo accounts and stores for the workshop (also shown on the login page). Re-running the seed resets them.
const demoStores = [
  { code: 'B01', name: 'Central Store' },
  { code: 'B02', name: 'Riverside Store' },
];

const DEMO_PASSWORD = 'password';

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const storesByCode: Record<string, { id: string; code: string; name: string }> = {};
  for (const store of demoStores) {
    const saved = await prisma.store.upsert({
      where: { code: store.code },
      update: { name: store.name },
      create: { code: store.code, name: store.name },
    });
    storesByCode[store.code] = saved;
  }

  const demoUsers = [
    { email: 'admin@erp.local', name: 'Admin User', role: Role.ADMIN, storeId: null },
    {
      email: 'buyer01@erp.local',
      name: 'Purchasing Officer',
      role: Role.PURCHASING,
      storeId: null,
    },
    { email: 'manager01@erp.local', name: 'Manager User', role: Role.MANAGER, storeId: null },
    {
      email: 'staff_b01@erp.local',
      name: 'Staff B01 (Central)',
      role: Role.STORE_STAFF,
      storeId: storesByCode['B01']?.id ?? null,
    },
    {
      email: 'staff_b02@erp.local',
      name: 'Staff B02 (Riverside)',
      role: Role.STORE_STAFF,
      storeId: storesByCode['B02']?.id ?? null,
    },
    // Keep legacy staff@erp.local mapped to B01 for compatibility
    {
      email: 'staff@erp.local',
      name: 'Staff User',
      role: Role.STORE_STAFF,
      storeId: storesByCode['B01']?.id ?? null,
    },
  ];

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, storeId: user.storeId },
      create: { ...user, passwordHash },
    });
  }
  console.log(
    `Seeded ${demoStores.length} stores and ${demoUsers.length} demo users (password: "${DEMO_PASSWORD}").`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
