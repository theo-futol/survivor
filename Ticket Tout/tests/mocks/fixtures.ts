export const SEED_PASSWORD = 'Secret123!';
export const SEED_PASSWORD_HASH = '94e0f9bc7f5a5225bd141bad5adf9befcc112aef09b88f47a14e20b75a7bbec2';

// Route params and body ids are validated with `z.uuid()`, so the rows the
// employeurs / salaries / partenaires / ministerfavorite suites act on need
// real UUIDs. The two legacy `*-test-*` rows are kept for the login and qrcode
// suites, which predate that validation.
export const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
export const COMPANY_USER_ID = '22222222-2222-4222-8222-222222222222';
export const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';
export const PARTNER_USER_ID = '44444444-4444-4444-8444-444444444444';
export const OTHER_COMPANY_USER_ID = '99999999-9999-4999-8999-999999999999';

export const EMPLOYER_COMPANY_ID = '55555555-5555-4555-8555-555555555555';
export const PARTNER_COMPANY_ID = '66666666-6666-4666-8666-666666666666';
export const OTHER_COMPANY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const UNKNOWN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const FREE_DOCUMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

export const usersFixture = [
  { id: 'user-test-1', email: 'test-login@example.com', surname: 'Test', name: 'User', role: 'COMPANY', balance: 0, password: SEED_PASSWORD_HASH, documentId: 'doc-test-1', companyId: null, expiredAt: null, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'user-test-2', email: 'test-salarie@example.com', surname: 'Test', name: 'Salarie', role: 'EMPLOYEE', balance: 0, password: SEED_PASSWORD_HASH, documentId: 'doc-test-2', companyId: null, expiredAt: null, createdAt: '2026-01-01T00:00:00Z' },

  { id: ADMIN_ID, email: 'admin@example.com', surname: 'Root', name: 'Admin', role: 'ADMIN', balance: 0, password: SEED_PASSWORD_HASH, documentId: 'doc-admin', companyId: null, expiredAt: null, createdAt: '2026-02-01T00:00:00Z' },
  { id: COMPANY_USER_ID, email: 'company@example.com', surname: 'Boss', name: 'Company', role: 'COMPANY', balance: 0, password: SEED_PASSWORD_HASH, documentId: 'doc-company', companyId: EMPLOYER_COMPANY_ID, expiredAt: null, createdAt: '2026-02-02T00:00:00Z' },
  { id: EMPLOYEE_ID, email: 'employee@example.com', surname: 'Dupont', name: 'Jean', role: 'EMPLOYEE', balance: 1000, password: SEED_PASSWORD_HASH, documentId: 'doc-employee', companyId: EMPLOYER_COMPANY_ID, expiredAt: null, createdAt: '2026-02-03T00:00:00Z' },
  { id: PARTNER_USER_ID, email: 'partner-user@example.com', surname: 'Martin', name: 'Partner', role: 'PARTNER', balance: 0, password: SEED_PASSWORD_HASH, documentId: 'doc-partner', companyId: PARTNER_COMPANY_ID, expiredAt: null, createdAt: '2026-02-04T00:00:00Z' },
  { id: OTHER_COMPANY_USER_ID, email: 'other-company@example.com', surname: 'Other', name: 'Company', role: 'COMPANY', balance: 0, password: SEED_PASSWORD_HASH, documentId: 'doc-other', companyId: OTHER_COMPANY_ID, expiredAt: null, createdAt: '2026-02-05T00:00:00Z' },
];

export const companyFixture = [
  { id: 'company-test-1', name: 'Test Partner', email: 'partner@example.com', siret: '12345678901234', verified: true, isFeatured: false, isPartner: true, active: true, categoryId: 1, createdAt: '2026-01-01T00:00:00Z' },

  { id: EMPLOYER_COMPANY_ID, name: 'Entreprise SA', email: 'employer@example.com', siret: '11111111111111', kbisId: 'kbis-employer', address: '1 rue A', postalCode: '75001', agentId: 1, reasonId: 1, categoryId: 1, verified: true, isFeatured: false, isPartner: false, active: true, createdAt: '2026-02-01T00:00:00Z' },
  { id: PARTNER_COMPANY_ID, name: 'Partenaire SARL', email: 'partenaire@example.com', siret: '22222222222222', kbisId: 'kbis-partner', address: '2 rue B', postalCode: '75002', agentId: 1, reasonId: 1, categoryId: 1, verified: true, isFeatured: true, isPartner: true, active: true, createdAt: '2026-02-02T00:00:00Z' },
  { id: OTHER_COMPANY_ID, name: 'Autre SA', email: 'autre@example.com', siret: '33333333333333', kbisId: 'kbis-other', address: '3 rue C', postalCode: '75003', agentId: 1, reasonId: 1, categoryId: 1, verified: true, isFeatured: false, isPartner: false, active: true, createdAt: '2026-02-03T00:00:00Z' },
];

export const companyCategoryFixture = [
  { id: 1, category: 'Restauration' },
  { id: 2, category: 'Culture' },
];

export const transactionFixture = [
  { id: 'tx-1', userId: EMPLOYEE_ID, companyId: PARTNER_COMPANY_ID, amount: 300, type: 'PAYMENT', status: 'VALIDER', createdAt: '2026-03-01T00:00:00Z' },
  { id: 'tx-2', userId: EMPLOYEE_ID, companyId: PARTNER_COMPANY_ID, amount: 200, type: 'PAYMENT', status: 'VALIDER', createdAt: '2026-03-02T00:00:00Z' },
];

export const bannedUserFixture: Record<string, unknown>[] = [];

export const ministerFavoriteFixture = [
  { id: 1, companyId: PARTNER_COMPANY_ID, likeAmount: 4, createdAt: '2026-03-01T00:00:00Z' },
];

export const qrCodeFixture: Record<string, unknown>[] = [];
