import { mockTables } from './mock-db';

type Row = Record<string, unknown>;
type QueryResult = { rows: Row[]; rowCount: number };

// Narrow stand-in for lib/services/postgres_client: it understands only the raw
// statements the abondement route issues, and ignores the transaction control
// statements. Anything else throws so a new raw query can't silently no-op.
function query(text: string, values: unknown[] = []): QueryResult
{
  const sql = text.trim().replace(/\s+/g, ' ');

  if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql))
  {
    return { rows: [], rowCount: 0 };
  }

  if (/^SELECT id, balance FROM users WHERE "companyId" = \$1 AND role = \$2 AND "expiredAt" IS NULL FOR UPDATE$/i.test(sql))
  {
    const rows = mockTables['Users']!
      .filter((row) => row['companyId'] === values[0] && row['role'] === values[1] && (row['expiredAt'] ?? null) === null)
      .map((row) => ({ id: row['id'], balance: row['balance'] }));

    return { rows, rowCount: rows.length };
  }

  // The abondement ledger row, one INSERT per credited employee.
  if (/^INSERT INTO "transaction" \(id, type, "userId", "companyId", amount, "newBalance", status\) VALUES \(\$1, 'TOPUP', \$2, NULL, \$3, \$4, 'VALIDER'\)$/i.test(sql))
  {
    mockTables['Transaction']!.push({
      id: values[0],
      type: 'TOPUP',
      userId: values[1],
      companyId: null,
      amount: values[2],
      newBalance: values[3],
      originalTransactionId: null,
      status: 'VALIDER',
      createdAt: new Date().toISOString(),
    });

    return { rows: [], rowCount: 1 };
  }

  // app/api/v1/salaries/[salarieId]/transactions — reads one balance under a row
  // lock, then writes the recomputed value back absolutely.
  if (/^SELECT balance FROM users WHERE id = \$1 FOR UPDATE$/i.test(sql))
  {
    const rows = mockTables['Users']!
      .filter((row) => row['id'] === values[0])
      .map((row) => ({ balance: row['balance'] }));

    return { rows, rowCount: rows.length };
  }

  // app/api/v1/salaries/[salarieId]/transactions — the scanned QR code, read
  // under the same lock as the balance so it can be consumed on success.
  if (/^SELECT id, "userId", "companyId", "expiredAt" FROM "qrCode" WHERE content = \$1 FOR UPDATE$/i.test(sql))
  {
    const rows = mockTables['QrCode']!
      .filter((row) => row['content'] === values[0])
      .map((row) => ({
        id: row['id'],
        userId: row['userId'],
        companyId: row['companyId'],
        expiredAt: row['expiredAt'],
      }));

    return { rows, rowCount: rows.length };
  }

  if (/^DELETE FROM "qrCode" WHERE id = \$1$/i.test(sql))
  {
    const before = mockTables['QrCode']!.length;
    mockTables['QrCode'] = mockTables['QrCode']!.filter((row) => row['id'] !== values[0]);

    return { rows: [], rowCount: before - mockTables['QrCode']!.length };
  }

  // The ledger row for a QR code payment, refund or top-up. The id is left to
  // the database, so the mock assigns one the same way the ORM mock does.
  if (/^INSERT INTO "transaction" \(type, "userId", "companyId", amount, "newBalance", status\) VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\)$/i.test(sql))
  {
    mockTables['Transaction']!.push({
      id: `transaction-${mockTables['Transaction']!.length + 1}`,
      type: values[0],
      userId: values[1],
      companyId: values[2],
      amount: values[3],
      newBalance: values[4],
      originalTransactionId: null,
      status: values[5],
      createdAt: new Date().toISOString(),
    });

    return { rows: [], rowCount: 1 };
  }

  if (/^UPDATE users SET balance = \$1 WHERE id = \$2$/i.test(sql))
  {
    const targets = mockTables['Users']!.filter((row) => row['id'] === values[1]);

    for (const row of targets)
    {
      row['balance'] = Number(values[0]);
    }

    return { rows: [], rowCount: targets.length };
  }

  if (/^UPDATE users SET balance = balance \+ \$1 WHERE id = ANY\(\$2::text\[\]\)$/i.test(sql))
  {
    const ids = values[1] as string[];
    const targets = mockTables['Users']!.filter((row) => ids.includes(row['id'] as string));

    for (const row of targets)
    {
      row['balance'] = Number(row['balance'] ?? 0) + Number(values[0]);
    }

    return { rows: [], rowCount: targets.length };
  }

  throw new Error(`mock-postgres: unsupported query: ${sql}`);
}

type MockClient = {
  query: (text: string, values?: unknown[]) => Promise<QueryResult>;
  release: () => void;
};

// Test hook: lets a suite act at a chosen point *inside* another request's
// transaction, so an interleaving can be provoked deterministically instead of
// being left to whichever await happens to resolve first.
let queryListener: ((sql: string, values: unknown[]) => void | Promise<void>) | null = null;

export function onQuery(listener: ((sql: string, values: unknown[]) => void | Promise<void>) | null): void
{
  queryListener = listener;
}

const client: MockClient = {
  query: async (text: string, values?: unknown[]) =>
  {
    await queryListener?.(text.trim().replace(/\s+/g, ' '), values ?? []);

    return query(text, values);
  },
  release: () => {},
};

// Real Postgres serialises these callbacks through the `SELECT … FOR UPDATE`
// row lock the routes take: a second transaction blocks until the first
// commits, so it can never read a balance that is about to change. The mock
// has no locks, so without this queue two overlapping requests would both read
// the same stale balance — a lost update the real database would never allow.
// The queue is global rather than per row, which is stricter than Postgres:
// it also serialises transactions touching unrelated rows.
let inFlight: Promise<unknown> = Promise.resolve();

export async function withTransaction<T>(callback: (client: MockClient) => Promise<T>): Promise<T>
{
  const run = inFlight.then(() => callback(client));

  // A failed transaction must not wedge the queue for the next caller.
  inFlight = run.catch(() => {});

  return run;
}
