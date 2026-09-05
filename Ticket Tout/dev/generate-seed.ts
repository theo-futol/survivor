// Deterministic seed generator for Ticket Tout.
//
// Run with `npm run db:seed:generate` (from `Ticket Tout/`). No DB connection
// needed: this script only computes a fixed dataset and writes plain SQL /
// CSV / markdown files under `mocks/`. Two runs on an empty database must
// produce byte-identical output, so nothing here may call `Date.now()`,
// `Math.random()`, or `crypto.randomUUID()` — see SEED / REFERENCE_DATE below.
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../lib/services/auth_service';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MOCKS_DIR = path.join(REPO_ROOT, 'mocks');

// ---------------------------------------------------------------------------
// Determinism primitives
// ---------------------------------------------------------------------------

const SEED = 0x5eed2026;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);

function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}

/** Deterministic, unique, UUID-shaped id derived from a stable label. */
function seededId(label: string): string {
  const hex = createHash('sha256').update(label).digest('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), '4' + hex.slice(13, 16), '8' + hex.slice(17, 20), hex.slice(20, 32)].join(
    '-',
  );
}

// Reference date is fixed and explicit — never `now()` — so two seed runs
// (and the seed's own CSV export) always agree.
const REFERENCE_DATE = Date.UTC(2026, 8, 1, 0, 0, 0); // 2026-09-01T00:00:00Z
const WINDOW_DAYS = 90;
const WINDOW_START = REFERENCE_DATE - WINDOW_DAYS * 24 * 60 * 60 * 1000;

function dayOffset(day: number, hour: number, minute: number): number {
  return WINDOW_START + day * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000 + minute * 60 * 1000;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------
// SQL literal helpers
// ---------------------------------------------------------------------------

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}
function sqlNullableStr(v: string | null): string {
  return v === null ? 'NULL' : sqlStr(v);
}
function sqlInt(v: number): string {
  return String(v);
}
function sqlBool(v: boolean): string {
  return v ? 'TRUE' : 'FALSE';
}
function sqlTs(ms: number): string {
  return sqlStr(toIso(ms));
}

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Lucas', 'Emma', 'Louis', 'Chloe', 'Hugo', 'Lea', 'Nathan', 'Manon', 'Enzo', 'Camille',
  'Gabriel', 'Sarah', 'Adam', 'Ines', 'Raphael', 'Jade', 'Arthur', 'Louise', 'Jules', 'Alice',
  'Mohamed', 'Zoe', 'Ethan', 'Anna', 'Noah', 'Julia', 'Liam', 'Rose', 'Sacha', 'Nina',
  'Tom', 'Lina', 'Mael', 'Eva', 'Nolan', 'Mila', 'Aaron', 'Lena', 'Theo', 'Juliette',
  'Yanis', 'Clara', 'Mathis', 'Lucie', 'Baptiste', 'Margaux', 'Antoine', 'Oceane', 'Victor', 'Charlotte',
] as const;

const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
  'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier',
  'Morel', 'Girard', 'Andre', 'Lefevre', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'Francois', 'Martinez',
  'Legrand', 'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guerin', 'Muller', 'Henry', 'Roussel', 'Nicolas',
  'Perrin', 'Morin', 'Mathieu', 'Clement', 'Gauthier', 'Dumont', 'Marchand', 'Renard', 'Chevalier', 'Robin',
] as const;

if (FIRST_NAMES.length !== 50 || LAST_NAMES.length !== 50) {
  throw new Error('expected exactly 50 first/last names');
}

const CATEGORIES = ['Restauration', 'Librairie & Papeterie', 'Sport & Bien-être', 'Culture & Loisirs'] as const;

type Company = {
  name: string;
  category: (typeof CATEGORIES)[number];
  city: string;
  postalCode: string;
  region: string;
  siret: string;
};

const COMPANIES: Company[] = [
  { name: 'Le Bistrot des Halles', category: 'Restauration', city: 'Paris', postalCode: '75001', region: 'Île-de-France', siret: '40312345600011' },
  { name: 'Chez Antoine', category: 'Restauration', city: 'Levallois-Perret', postalCode: '92300', region: 'Île-de-France', siret: '40312345600028' },
  { name: "La Table d'Amélie", category: 'Restauration', city: 'Lyon', postalCode: '69002', region: 'Auvergne-Rhône-Alpes', siret: '40312345600035' },
  { name: 'Librairie du Marché', category: 'Librairie & Papeterie', city: 'Paris', postalCode: '75011', region: 'Île-de-France', siret: '40312345600042' },
  { name: 'Papeterie Voltaire', category: 'Librairie & Papeterie', city: 'Bordeaux', postalCode: '33000', region: 'Nouvelle-Aquitaine', siret: '40312345600059' },
  { name: 'Librairie des Arts', category: 'Librairie & Papeterie', city: 'Lille', postalCode: '59000', region: 'Hauts-de-France', siret: '40312345600066' },
  { name: 'Studio Yoga Zen', category: 'Sport & Bien-être', city: 'Lyon', postalCode: '69003', region: 'Auvergne-Rhône-Alpes', siret: '40312345600073' },
  { name: 'Salle Sport Forme', category: 'Sport & Bien-être', city: 'Bordeaux', postalCode: '33200', region: 'Nouvelle-Aquitaine', siret: '40312345600080' },
  { name: 'Spa Sérénité', category: 'Sport & Bien-être', city: 'Lille', postalCode: '59800', region: 'Hauts-de-France', siret: '40312345600097' },
  { name: 'Ciné Palace', category: 'Culture & Loisirs', city: 'Créteil', postalCode: '94000', region: 'Île-de-France', siret: '40312345600103' },
  { name: 'Café du Musée', category: 'Culture & Loisirs', city: 'Bordeaux', postalCode: '33800', region: 'Nouvelle-Aquitaine', siret: '40312345600110' },
  { name: 'Théâtre du Nord', category: 'Culture & Loisirs', city: 'Calais', postalCode: '62100', region: 'Hauts-de-France', siret: '40312345600127' },
];

if (COMPANIES.length !== 12) {
  throw new Error('expected exactly 12 partner companies');
}
if (new Set(COMPANIES.map((c) => c.category)).size < 4) {
  throw new Error('expected at least 4 distinct categories among partners');
}
if (new Set(COMPANIES.map((c) => c.region)).size < 3) {
  throw new Error('expected at least 3 distinct régions among partners');
}

const SEED_PASSWORD = 'Secret123!';
const ADMIN_PASSWORD = 'Admin1234!';
const ADMIN_EMAIL = 'admin.seed@tickettout.fr';

// ---------------------------------------------------------------------------
// Lookup rows
// ---------------------------------------------------------------------------

const administration = { id: 1, name: 'Direction Régionale des Entreprises' };

const validationReasons = [
  { id: 1, reason: 'Dossier complet et conforme' },
  { id: 2, reason: 'Pièces justificatives vérifiées par un agent' },
];

const companyCategories = CATEGORIES.map((category, i) => ({ id: i + 1, category }));
const categoryIdByName = new Map(companyCategories.map((c) => [c.category, c.id]));

// ---------------------------------------------------------------------------
// Documents, employees, admin, partners
// ---------------------------------------------------------------------------

type DocumentRow = { id: string; storageKey: string; mimeType: string; size: number; createdAt: number };
const documents: DocumentRow[] = [];

function makeDocument(label: string, createdAt: number): DocumentRow {
  const doc: DocumentRow = {
    id: seededId(`document:${label}`),
    storageKey: `seed/${label}.pdf`,
    mimeType: 'application/pdf',
    size: randInt(80_000, 400_000),
    createdAt,
  };
  documents.push(doc);
  return doc;
}

const EMPLOYEE_CREATED_AT = WINDOW_START;

type Employee = {
  index: number;
  id: string;
  email: string;
  name: string;
  surname: string;
  documentId: string;
  balance: number; // filled in after the replay
};

const employees: Employee[] = [];
for (let i = 0; i < 50; i++) {
  const surname = FIRST_NAMES[i]!;
  const name = LAST_NAMES[i]!;
  const doc = makeDocument(`employees/${String(i).padStart(2, '0')}`, EMPLOYEE_CREATED_AT);
  employees.push({
    index: i,
    id: seededId(`employee:${i}`),
    email: `${surname.toLowerCase()}.${name.toLowerCase()}${i}@example.fr`,
    name,
    surname,
    documentId: doc.id,
    balance: 0,
  });
}

const adminDoc = makeDocument('admin/00', EMPLOYEE_CREATED_AT);
const admin = {
  id: seededId('admin:0'),
  email: ADMIN_EMAIL,
  name: 'Admin',
  surname: 'Seed',
  documentId: adminDoc.id,
};

type Partner = { index: number; id: string; kbisId: string; company: Company };
const partners: Partner[] = COMPANIES.map((company, i) => {
  const kbis = makeDocument(`companies/${String(i).padStart(2, '0')}/kbis`, EMPLOYEE_CREATED_AT);
  return { index: i, id: seededId(`company:${i}`), kbisId: kbis.id, company };
});

// ---------------------------------------------------------------------------
// Chronological balance replay — the actual seed logic.
//
// Each employee gets 2 employer TOPUP credits early in the window, then
// exactly 4 customer-facing events (PAYMENT and, for a subset, REFUND)
// spread across the remaining days. 50 employees x 4 = 200, matching the
// spec's "200 transactions" (TOPUP rows are not counted and not exported).
//
// A PAYMENT only succeeds if amount <= running balance at that instant;
// otherwise it's recorded REFUSER and the balance is untouched. No row is
// ever UPDATEd — every balance change is a new, time-ordered INSERT, and
// Users.balance is read straight out of the replay, never hardcoded.
// ---------------------------------------------------------------------------

type TxType = 'PAYMENT' | 'REFUND' | 'TOPUP';
type TxStatus = 'VALIDER' | 'REFUSER';

type TxRow = {
  id: string;
  type: TxType;
  userId: string;
  companyId: string | null;
  amount: number;
  originalTransactionId: string | null;
  status: TxStatus;
  createdAt: number;
};

const transactions: TxRow[] = [];

const REFUSED_INDICES = new Set([0, 1, 2, 3, 4]);
const ZERO_BALANCE_INDICES = new Set([10, 11, 12]);
const SUB_5EUR_INDICES = new Set([20, 21]);
const REFUND_INDICES = new Set([30, 31, 32, 33, 34, 35, 36, 37, 38, 39]);

let txCounter = 0;
function nextTxId(employeeIndex: number): string {
  txCounter += 1;
  return seededId(`transaction:${employeeIndex}:${txCounter}`);
}

for (const employee of employees) {
  const i = employee.index;
  let balance = 0;

  // Two employer top-ups, always before any customer-facing event, so the
  // final balance for the special groups below depends only on the 4
  // customer events that follow.
  const topup1Day = randInt(1, 8);
  const topup1Amount = randInt(3000, 6000);
  balance += topup1Amount;
  transactions.push({
    id: nextTxId(i),
    type: 'TOPUP',
    userId: employee.id,
    companyId: null,
    amount: topup1Amount,
    originalTransactionId: null,
    status: 'VALIDER',
    createdAt: dayOffset(topup1Day, randInt(8, 11), randInt(0, 59)),
  });

  const topup2Day = randInt(14, 22);
  const topup2Amount = randInt(3000, 6000);
  balance += topup2Amount;
  transactions.push({
    id: nextTxId(i),
    type: 'TOPUP',
    userId: employee.id,
    companyId: null,
    amount: topup2Amount,
    originalTransactionId: null,
    status: 'VALIDER',
    createdAt: dayOffset(topup2Day, randInt(8, 11), randInt(0, 59)),
  });

  // 4 customer-facing events, spread across the rest of the window.
  const eventDays = [
    randInt(28, 34),
    randInt(42, 48),
    randInt(58, 64),
    randInt(72, 78),
  ];

  const isRefund = REFUND_INDICES.has(i);
  const isRefused = REFUSED_INDICES.has(i);
  const isZeroTarget = ZERO_BALANCE_INDICES.has(i);
  const isSubFiveTarget = SUB_5EUR_INDICES.has(i);

  let lastPaymentForRefund: TxRow | null = null;

  for (let e = 0; e < 4; e++) {
    const createdAt = dayOffset(eventDays[e]!, randInt(9, 19), randInt(0, 59));
    const partner = pick(partners);

    // Employee 30-39: slot 1 is a REFUND reversing slot 0's payment.
    if (isRefund && e === 1 && lastPaymentForRefund) {
      const refundAmount = lastPaymentForRefund.amount;
      balance += refundAmount;
      transactions.push({
        id: nextTxId(i),
        type: 'REFUND',
        userId: employee.id,
        companyId: lastPaymentForRefund.companyId,
        amount: refundAmount,
        originalTransactionId: lastPaymentForRefund.id,
        status: 'VALIDER',
        createdAt,
      });
      continue;
    }

    const isLastEvent = e === 3;

    if (isLastEvent && isZeroTarget) {
      const amount = balance;
      balance -= amount;
      transactions.push({
        id: nextTxId(i),
        type: 'PAYMENT',
        userId: employee.id,
        companyId: partner.id,
        amount,
        originalTransactionId: null,
        status: 'VALIDER',
        createdAt,
      });
      continue;
    }

    if (isLastEvent && isSubFiveTarget) {
      const targetRemainder = randInt(50, 450);
      const amount = Math.max(1, balance - targetRemainder);
      balance -= amount;
      transactions.push({
        id: nextTxId(i),
        type: 'PAYMENT',
        userId: employee.id,
        companyId: partner.id,
        amount,
        originalTransactionId: null,
        status: 'VALIDER',
        createdAt,
      });
      continue;
    }

    // Designated slot for a genuine insufficient-balance refusal: request
    // strictly more than the current balance.
    if (isRefused && e === 2) {
      const amount = balance + randInt(500, 1500);
      transactions.push({
        id: nextTxId(i),
        type: 'PAYMENT',
        userId: employee.id,
        companyId: partner.id,
        amount,
        originalTransactionId: null,
        status: 'REFUSER',
        createdAt,
      });
      continue;
    }

    // Generic case: spend a plausible amount, but always leave a healthy
    // cushion (>= 1000 cents) so generic employees never drift into the
    // 0 / sub-5€ bands that are reserved for the designated groups above.
    const safetyMargin = 1000;
    const maxSafeSpend = Math.max(0, balance - safetyMargin);
    const amount = Math.min(maxSafeSpend, randInt(300, 1200));
    balance -= amount;
    const row: TxRow = {
      id: nextTxId(i),
      type: 'PAYMENT',
      userId: employee.id,
      companyId: partner.id,
      amount,
      originalTransactionId: null,
      status: 'VALIDER',
      createdAt,
    };
    transactions.push(row);
    lastPaymentForRefund = row;
  }

  employee.balance = balance;
}

// ---------------------------------------------------------------------------
// Sanity checks — fail loudly rather than emit a non-compliant seed.
// ---------------------------------------------------------------------------

const customerFacing = transactions.filter((t) => t.type !== 'TOPUP');
if (customerFacing.length !== 200) {
  throw new Error(`expected 200 PAYMENT/REFUND transactions, got ${customerFacing.length}`);
}
const refusedCount = customerFacing.filter((t) => t.status === 'REFUSER').length;
if (refusedCount < 5) {
  throw new Error(`expected at least 5 REFUSER transactions, got ${refusedCount}`);
}
const zeroBalanceCount = employees.filter((e) => e.balance === 0).length;
if (zeroBalanceCount !== 3) {
  throw new Error(`expected exactly 3 employees at balance 0, got ${zeroBalanceCount}`);
}
const subFiveCount = employees.filter((e) => e.balance > 0 && e.balance < 500).length;
if (subFiveCount !== 2) {
  throw new Error(`expected exactly 2 employees with 0 < balance < 500, got ${subFiveCount}`);
}
for (const e of employees) {
  if (e.balance < 0) throw new Error(`employee ${e.index} ended with a negative balance`);
}

// createdAt, id ordering used identically for the CSV export.
customerFacing.sort((a, b) => (a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.id.localeCompare(b.id)));
transactions.sort((a, b) => (a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.id.localeCompare(b.id)));

// ---------------------------------------------------------------------------
// Emit mocks/seed.sql
// ---------------------------------------------------------------------------

const lines: string[] = [];
lines.push('-- Deterministic seed data for Ticket Tout.');
lines.push('-- Generated by Ticket Tout/dev/generate-seed.ts — do not hand-edit.');
lines.push('-- Re-run `npm run db:seed:generate` (from Ticket Tout/) to regenerate byte-for-byte.');
lines.push('BEGIN;');
lines.push('');

lines.push('-- administration');
lines.push(
  `INSERT INTO public.administration (id, name) VALUES (${sqlInt(administration.id)}, ${sqlStr(administration.name)});`,
);
lines.push('');

lines.push('-- companyValidationReason');
for (const r of validationReasons) {
  lines.push(
    `INSERT INTO public."companyValidationReason" (id, reason) VALUES (${sqlInt(r.id)}, ${sqlStr(r.reason)});`,
  );
}
lines.push('');

lines.push('-- companyCategory');
for (const c of companyCategories) {
  lines.push(`INSERT INTO public."companyCategory" (id, category) VALUES (${sqlInt(c.id)}, ${sqlStr(c.category)});`);
}
lines.push('');

lines.push('-- document');
for (const d of documents) {
  lines.push(
    `INSERT INTO public.document (id, "storageKey", "mimeType", size, "createdAt") VALUES ` +
      `(${sqlStr(d.id)}, ${sqlStr(d.storageKey)}, ${sqlStr(d.mimeType)}, ${sqlInt(d.size)}, ${sqlTs(d.createdAt)});`,
  );
}
lines.push('');

lines.push('-- company (12 partners: >=4 categories, >=3 régions)');
partners.forEach((p, i) => {
  const c = p.company;
  const reasonId = validationReasons[i % validationReasons.length]!.id;
  const categoryId = categoryIdByName.get(c.category)!;
  lines.push(
    `INSERT INTO public.company (id, name, email, siret, "kbisId", address, "postalCode", "agentId", "reasonId", ` +
      `verified, "isFeatured", "categoryId", "isPartner", "createdAt", "updatedAt") VALUES (` +
      [
        sqlStr(p.id),
        sqlStr(c.name),
        sqlStr(`contact@${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.fr`),
        sqlStr(c.siret),
        sqlStr(p.kbisId),
        sqlStr(`${randInt(1, 120)} rue de la République`),
        sqlStr(c.postalCode),
        sqlInt(administration.id),
        sqlInt(reasonId),
        sqlBool(true),
        sqlBool(i % 3 === 0),
        sqlInt(categoryId),
        sqlBool(true),
        sqlTs(EMPLOYEE_CREATED_AT),
        sqlTs(EMPLOYEE_CREATED_AT),
      ].join(', ') +
      ');',
  );
});
lines.push('');

lines.push('-- users: 50 employees');
for (const e of employees) {
  lines.push(
    `INSERT INTO public.users (id, email, surname, name, role, balance, password, "createdAt", "updatedAt", ` +
      `"expiredAt", "documentId") VALUES (` +
      [
        sqlStr(e.id),
        sqlStr(e.email),
        sqlStr(e.surname),
        sqlStr(e.name),
        sqlStr('EMPLOYEE'),
        sqlInt(e.balance),
        sqlStr(hashPassword(SEED_PASSWORD)),
        sqlTs(EMPLOYEE_CREATED_AT),
        sqlTs(EMPLOYEE_CREATED_AT),
        'NULL',
        sqlStr(e.documentId),
      ].join(', ') +
      ');',
  );
}
lines.push('');

lines.push('-- users: 1 admin (for exercising admin-only routes)');
lines.push(
  `INSERT INTO public.users (id, email, surname, name, role, balance, password, "createdAt", "updatedAt", ` +
    `"expiredAt", "documentId") VALUES (` +
    [
      sqlStr(admin.id),
      sqlStr(admin.email),
      sqlStr(admin.surname),
      sqlStr(admin.name),
      sqlStr('ADMIN'),
      sqlInt(0),
      sqlStr(hashPassword(ADMIN_PASSWORD)),
      sqlTs(EMPLOYEE_CREATED_AT),
      sqlTs(EMPLOYEE_CREATED_AT),
      'NULL',
      sqlStr(admin.documentId),
    ].join(', ') +
    ');',
);
lines.push('');

lines.push('-- transaction: employer TOPUPs + 200 PAYMENT/REFUND rows, written in chronological order');
for (const t of transactions) {
  lines.push(
    `INSERT INTO public.transaction (id, type, "userId", "companyId", amount, "originalTransactionId", status, ` +
      `"createdAt") VALUES (` +
      [
        sqlStr(t.id),
        sqlStr(t.type),
        sqlStr(t.userId),
        sqlNullableStr(t.companyId),
        sqlInt(t.amount),
        sqlNullableStr(t.originalTransactionId),
        sqlStr(t.status),
        sqlTs(t.createdAt),
      ].join(', ') +
      ');',
  );
}
lines.push('');

lines.push('-- keep autoincrement sequences ahead of the seeded ids');
lines.push(
  `SELECT setval('public.administration_id_seq', (SELECT max(id) FROM public.administration), true);`,
);
lines.push(
  `SELECT setval('public."companyValidationReason_id_seq"', (SELECT max(id) FROM public."companyValidationReason"), true);`,
);
lines.push(
  `SELECT setval('public."companyCategory_id_seq"', (SELECT max(id) FROM public."companyCategory"), true);`,
);
lines.push('');

lines.push('COMMIT;');
lines.push('');

writeFileSync(path.join(MOCKS_DIR, 'seed.sql'), lines.join('\n'), 'utf8');

// ---------------------------------------------------------------------------
// Emit mocks/transactions.csv — the seed's own CSV export deliverable.
// UTF-8, `;`-separated, PAYMENT/REFUND only (TOPUP excluded), sorted by
// (createdAt, id) — the same order + formatting the seed data represents.
// ---------------------------------------------------------------------------

const CSV_HEADER = 'id;date_iso8601;employee_id;partner_id;amount_cents;status';
const csvRows = customerFacing.map(
  (t) => `${t.id};${toIso(t.createdAt)};${t.userId};${t.companyId};${t.amount};${t.status}`,
);
writeFileSync(path.join(MOCKS_DIR, 'transactions.csv'), [CSV_HEADER, ...csvRows].join('\n') + '\n', 'utf8');

// ---------------------------------------------------------------------------
// Emit mocks/justificatif.md — one zero-balance employee, 3 lines.
// ---------------------------------------------------------------------------

const justificatifEmployee = employees.find((e) => e.balance === 0 && ZERO_BALANCE_INDICES.has(e.index))!;
const employeeTx = transactions
  .filter((t) => t.userId === justificatifEmployee.id)
  .sort((a, b) => a.createdAt - b.createdAt);

const abondements = employeeTx.filter((t) => t.type === 'TOPUP');
const debits = employeeTx.filter((t) => t.type === 'PAYMENT' && t.status === 'VALIDER');
const totalAbondements = abondements.reduce((s, t) => s + t.amount, 0);
const totalDebits = debits.reduce((s, t) => s + t.amount, 0);

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}
function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const justificatif = [
  `# Justificatif — salarié à solde zéro`,
  '',
  `Salarié \`${justificatifEmployee.id}\` (${justificatifEmployee.surname} ${justificatifEmployee.name}) :`,
  '',
  `- Abondements : ${abondements.map((t) => `+${centsToEuros(t.amount)} (${shortDate(t.createdAt)})`).join(', ')} = ${centsToEuros(totalAbondements)}`,
  `- Débits validés : ${debits.map((t) => `-${centsToEuros(t.amount)} (${shortDate(t.createdAt)})`).join(', ')} = -${centsToEuros(totalDebits)}`,
  `- Total recalculé : ${centsToEuros(totalAbondements)} - ${centsToEuros(totalDebits)} = ${centsToEuros(totalAbondements - totalDebits)} (solde en base : ${centsToEuros(justificatifEmployee.balance)})`,
  '',
].join('\n');

writeFileSync(path.join(MOCKS_DIR, 'justificatif.md'), justificatif, 'utf8');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('Seed generated:');
console.log(`  employees: ${employees.length}`);
console.log(`  partners: ${partners.length} (${new Set(COMPANIES.map((c) => c.category)).size} categories, ${new Set(COMPANIES.map((c) => c.region)).size} régions)`);
console.log(`  transactions (PAYMENT/REFUND, exported): ${customerFacing.length}`);
console.log(`  transactions (TOPUP, not exported): ${transactions.length - customerFacing.length}`);
console.log(`  refused (insufficient balance): ${refusedCount}`);
console.log(`  employees at balance 0: ${zeroBalanceCount}`);
console.log(`  employees with 0 < balance < 5€: ${subFiveCount}`);
console.log(`  admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
console.log(`  wrote: mocks/seed.sql, mocks/transactions.csv, mocks/justificatif.md`);
