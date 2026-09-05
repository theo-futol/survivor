import { Temporal } from '@js-temporal/polyfill';
import {
  bannedUserFixture,
  companyCategoryFixture,
  companyFixture,
  ministerFavoriteFixture,
  qrCodeFixture,
  transactionFixture,
  usersFixture,
} from './fixtures';

if (typeof globalThis.Temporal === 'undefined')
{
  globalThis.Temporal = Temporal as unknown as typeof globalThis.Temporal;
}

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;
type Sort = { field: string; direction: 'asc' | 'desc' };

// Relations the routes eager-load with `.include()`: which local column points
// at which table's `id`.
const RELATIONS: Record<string, Record<string, { table: string; localField: string }>> = {
  Company: { category: { table: 'CompanyCategory', localField: 'categoryId' } },
  MinisterFavorite: { company: { table: 'Company', localField: 'companyId' } },
};

function compare(a: unknown, b: unknown): number
{
  if (a === b) return 0;
  return String(a) < String(b) ? -1 : 1;
}

// Stands in for the ORM's field proxy: `u.field.<op>(value)` builds a
// predicate, `u.field.asc()/.desc()` builds a sort spec.
function fieldProxy(): Record<string, unknown>
{
  return new Proxy({}, {
    get: (_target, field: string) => ({
      eq: (value: unknown): Predicate => (row) => row[field] === value,
      neq: (value: unknown): Predicate => (row) => row[field] !== value,
      lt: (value: unknown): Predicate => (row) => compare(row[field], value) < 0,
      lte: (value: unknown): Predicate => (row) => compare(row[field], value) <= 0,
      gt: (value: unknown): Predicate => (row) => compare(row[field], value) > 0,
      gte: (value: unknown): Predicate => (row) => compare(row[field], value) >= 0,
      in: (values: unknown[]): Predicate => (row) => values.includes(row[field]),
      like: (pattern: string): Predicate => matchesLike(field, pattern, false),
      ilike: (pattern: string): Predicate => matchesLike(field, pattern, true),
      isNull: (): Predicate => (row) => row[field] === null || row[field] === undefined,
      isNotNull: (): Predicate => (row) => row[field] !== null && row[field] !== undefined,
      asc: (): Sort => ({ field, direction: 'asc' }),
      desc: (): Sort => ({ field, direction: 'desc' }),
    }),
  }) as Record<string, unknown>;
}

function matchesLike(field: string, pattern: string, insensitive: boolean): Predicate
{
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  const regex = new RegExp(`^${escaped}$`, insensitive ? 'i' : '');

  return (row) => typeof row[field] === 'string' && regex.test(row[field] as string);
}

const aggregateProxy = {
  count: () => ({ kind: 'count' as const }),
  sum: (field: string) => ({ kind: 'sum' as const, field }),
  avg: (field: string) => ({ kind: 'avg' as const, field }),
  min: (field: string) => ({ kind: 'min' as const, field }),
  max: (field: string) => ({ kind: 'max' as const, field }),
};

type AggregateSpec = { kind: 'count' } | { kind: 'sum' | 'avg' | 'min' | 'max'; field: string };

export function createMockDb()
{
  const tables: Record<string, Row[]> = {};

  function collection(name: string, state: {
    predicates: Predicate[];
    sorts: Sort[];
    limit?: number;
    offset?: number;
    fields?: string[];
    includes: { relation: string; select?: string[] }[];
  })
  {
    const next = (patch: Partial<typeof state>) => collection(name, { ...state, ...patch });

    const matching = (): Row[] => tables[name]!.filter((row) => state.predicates.every((p) => p(row)));

    const project = (row: Row): Row =>
    {
      const base: Row = state.fields === undefined
        ? { ...row }
        : Object.fromEntries(state.fields.map((field) => [field, row[field]]));

      for (const include of state.includes)
      {
        const relation = RELATIONS[name]?.[include.relation];

        if (!relation) continue;

        const target = tables[relation.table]!.find((candidate) => candidate['id'] === row[relation.localField]);

        base[include.relation] = target === undefined
          ? null
          : include.select === undefined
            ? { ...target }
            : Object.fromEntries(include.select.map((field) => [field, target[field]]));
      }

      return base;
    };

    const resolved = (): Row[] =>
    {
      let rows = matching();

      for (const sort of [...state.sorts].reverse())
      {
        rows = [...rows].sort((a, b) =>
          sort.direction === 'asc' ? compare(a[sort.field], b[sort.field]) : compare(b[sort.field], a[sort.field]));
      }

      const start = state.offset ?? 0;
      const end = state.limit === undefined ? undefined : start + state.limit;

      return rows.slice(start, end).map(project);
    };

    return {
      where(condition: Row | ((fields: Record<string, unknown>) => Predicate))
      {
        const predicate: Predicate = typeof condition === 'function'
          ? condition(fieldProxy())
          : (row) => Object.entries(condition).every(([key, value]) => row[key] === value);

        return next({ predicates: [...state.predicates, predicate] });
      },
      select(...fields: string[])
      {
        return next({ fields });
      },
      orderBy(builder: (fields: Record<string, unknown>) => Sort)
      {
        return next({ sorts: [...state.sorts, builder(fieldProxy())] });
      },
      limit(value: number)
      {
        return next({ limit: value });
      },
      offset(value: number)
      {
        return next({ offset: value });
      },
      include(relation: string, branch?: (b: { select: (...f: string[]) => { fields: string[] } }) => { fields: string[] })
      {
        const selected = branch === undefined
          ? undefined
          : branch({ select: (...fields: string[]) => ({ fields }) }).fields;

        return next({
          includes: [...state.includes, selected === undefined ? { relation } : { relation, select: selected }],
        });
      },
      async all()
      {
        return resolved();
      },
      async first()
      {
        return resolved()[0] ?? null;
      },
      async aggregate(builder: (aggregate: typeof aggregateProxy) => Record<string, AggregateSpec>)
      {
        const rows = matching();
        const specs = builder(aggregateProxy);

        return Object.fromEntries(Object.entries(specs).map(([key, spec]) =>
        {
          if (spec.kind === 'count') return [key, rows.length];

          const values = rows.map((row) => Number(row[spec.field] ?? 0));

          if (values.length === 0) return [key, null];
          if (spec.kind === 'sum') return [key, values.reduce((a, b) => a + b, 0)];
          if (spec.kind === 'avg') return [key, values.reduce((a, b) => a + b, 0) / values.length];
          if (spec.kind === 'min') return [key, Math.min(...values)];

          return [key, Math.max(...values)];
        }));
      },
      async create(data: Row)
      {
        const row = { id: `${name.toLowerCase()}-${tables[name]!.length + 1}`, ...data };
        tables[name]!.push(row);
        return { ...row };
      },
      async update(values: Row)
      {
        const rows = matching();

        for (const row of rows)
        {
          Object.assign(row, values);
        }

        return rows.length;
      },
      async delete()
      {
        const doomed = new Set(matching());
        tables[name] = tables[name]!.filter((row) => !doomed.has(row));
        return doomed.size;
      },
    };
  }

  const root = (name: string) => collection(name, { predicates: [], sorts: [], includes: [] });

  const orm = new Proxy({}, {
    get: (_target, name: string) => root(name),
  });

  return {
    db: { orm: { public: orm } },
    tables,
  };
}

const { db: mockDb, tables } = createMockDb();

export const db = mockDb as unknown as typeof import('@/lib/prisma/db')['db'];

export function resetMockDb()
{
  const seed: Record<string, Row[]> = {
    Users: usersFixture,
    Company: companyFixture,
    CompanyCategory: companyCategoryFixture,
    Transaction: transactionFixture,
    BannedUser: bannedUserFixture,
    MinisterFavorite: ministerFavoriteFixture,
    QrCode: qrCodeFixture,
  };

  for (const key of Object.keys(tables))
  {
    delete tables[key];
  }

  for (const [name, rows] of Object.entries(seed))
  {
    tables[name] = rows.map((row) => ({ ...row }));
  }
}

export { tables as mockTables };

resetMockDb();
