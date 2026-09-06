#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3aef406a4dac1916022111ec37bec1bfd8a96403932cf52c47106189b4ae6406/contract';
import startContract from '../../snapshots/3aef406a4dac1916022111ec37bec1bfd8a96403932cf52c47106189b4ae6406/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e95c0443e1fd7b6dcf356942fe5d00ca51c321b904f65238b02da3a331bdd3f3/contract';
import endContract from '../../snapshots/e95c0443e1fd7b6dcf356942fe5d00ca51c321b904f65238b02da3a331bdd3f3/contract.json' with { type: 'json' };
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
