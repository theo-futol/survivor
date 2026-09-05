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

  if (/^SELECT id FROM users WHERE "companyId" = \$1 AND role = \$2 AND "expiredAt" IS NULL FOR UPDATE$/i.test(sql))
  {
    const rows = mockTables['Users']!
      .filter((row) => row['companyId'] === values[0] && row['role'] === values[1] && (row['expiredAt'] ?? null) === null)
      .map((row) => ({ id: row['id'] }));

    return { rows, rowCount: rows.length };
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

const client: MockClient = {
  query: async (text: string, values?: unknown[]) => query(text, values),
  release: () => {},
};

export async function withTransaction<T>(callback: (client: MockClient) => Promise<T>): Promise<T>
{
  return callback(client);
}
