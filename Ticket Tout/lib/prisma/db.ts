import 'dotenv/config'
import { Temporal } from '@js-temporal/polyfill';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '@/prisma/contract';
import contractJson from '@/prisma/contract.json' with { type: 'json' };

if (typeof globalThis.Temporal === 'undefined')
{
  globalThis.Temporal = Temporal as unknown as typeof globalThis.Temporal;
}

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
