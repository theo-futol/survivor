#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c65231faac1f674dc4f5664970871d5a9a2f35427c46207786fc0f58ef78d55c/contract';
import endContract from '../../snapshots/c65231faac1f674dc4f5664970871d5a9a2f35427c46207786fc0f58ef78d55c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d7dd146512eb4371934bcd70e7350ddedabb6179a77af8b4701bb1201bbafe9f/contract';
import startContract from '../../snapshots/d7dd146512eb4371934bcd70e7350ddedabb6179a77af8b4701bb1201bbafe9f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'featuredPartner',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('clickAmount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('companyId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('imageKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'featuredPartner',
        index: 'featuredPartner_active_idx_8af4daed',
        columns: ['active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'featuredPartner',
        index: 'featuredPartner_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'featuredPartner',
        index: 'featuredPartner_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'featuredPartner',
        foreignKey: {
          name: 'featuredPartner_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'company', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
