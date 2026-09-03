// Mock data backing tests/mocks/mock-db.ts, replacing the former tests/data.sql
// Postgres seed. Password hashes are SHA-256("Secret123!"), matching auth_service's
// hashPassword (see lib/services/auth_service.ts).

export const SEED_PASSWORD = 'Secret123!';
export const SEED_PASSWORD_HASH = '94e0f9bc7f5a5225bd141bad5adf9befcc112aef09b88f47a14e20b75a7bbec2';

export const usersFixture = [
  {
    id: 'user-test-1',
    email: 'test-login@example.com',
    surname: 'Test',
    name: 'User',
    role: 'COMPANY',
    balance: 0,
    password: SEED_PASSWORD_HASH,
    documentId: 'doc-test-1',
  },
  {
    id: 'user-test-2',
    email: 'test-salarie@example.com',
    surname: 'Test',
    name: 'Salarie',
    role: 'EMPLOYEE',
    balance: 0,
    password: SEED_PASSWORD_HASH,
    documentId: 'doc-test-2',
  },
];

export const companyFixture = [
  {
    id: 'company-test-1',
    name: 'Test Partner',
    email: 'partner@example.com',
    siret: '12345678901234',
    verified: true,
    isFeatured: false,
    isPartner: true,
  },
];

export const qrCodeFixture: Record<string, unknown>[] = [];
