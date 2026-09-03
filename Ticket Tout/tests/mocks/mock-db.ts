// In-memory stand-in for @/lib/prisma/db, wired in via jest.config.ts's
// moduleNameMapper so route/service code gets it transparently. Only implements
// the `.where(condition).first()` / `.create(data)` calls the app currently uses.
import { Temporal } from '@js-temporal/polyfill';
import { usersFixture, companyFixture, qrCodeFixture } from './fixtures';

// The real @/lib/prisma/db.ts polyfills globalThis.Temporal as a side effect of
// import; since this mock replaces that module, callers relying on the global
// (e.g. qrcode_service.ts) need it replicated here.
if (typeof globalThis.Temporal === 'undefined')
{
  globalThis.Temporal = Temporal as unknown as typeof globalThis.Temporal;
}

type Row = Record<string, unknown>;

function matches(row: Row, condition: Row): boolean
{
  return Object.entries(condition).every(([key, value]) => row[key] === value);
}

function createTable(initialRows: Row[])
{
  let rows: Row[] = initialRows.map((row) => ({ ...row }));

  return {
    where(condition: Row)
    {
      return {
        first: async () => rows.find((row) => matches(row, condition)) ?? null,
      };
    },
    create: async (data: Row) =>
    {
      const row = { ...data };

      rows.push(row);

      return row;
    },
    reset(nextRows: Row[])
    {
      rows = nextRows.map((row) => ({ ...row }));
    },
  };
}

const tables = {
  Users: createTable(usersFixture),
  Company: createTable(companyFixture),
  QrCode: createTable(qrCodeFixture),
};

export const db = {
  orm: {
    public: tables,
  },
};

export function resetMockDb()
{
  tables.Users.reset(usersFixture);
  tables.Company.reset(companyFixture);
  tables.QrCode.reset(qrCodeFixture);
}
