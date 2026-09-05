#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3aef406a4dac1916022111ec37bec1bfd8a96403932cf52c47106189b4ae6406/contract';
import endContract from '../../snapshots/3aef406a4dac1916022111ec37bec1bfd8a96403932cf52c47106189b4ae6406/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/61773de56ef951f1ac3d240a18433f7539dff5e104f355a4bc902b55b2d43971/contract';
import startContract from '../../snapshots/61773de56ef951f1ac3d240a18433f7539dff5e104f355a4bc902b55b2d43971/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'bannedUser',
        column: col('createdAt', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('active', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('companyId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bannedUser',
        column: col('reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      // `reason` is NOT NULL with no default, so rows that predate the column
      // need a value before the constraint goes on. Bans created before this
      // migration have no recorded motive; empty string stands in for that.
      rawSql({
        id: 'data.public.bannedUser.reason.backfill',
        label: 'Backfill "reason" on pre-existing "bannedUser" rows',
        operationClass: 'data',
        target: {
          id: 'postgres',
          details: { schema: 'public', objectType: 'column', name: 'reason', table: 'bannedUser' },
        },
        execute: [
          {
            description: 'backfill "reason" where it is null',
            sql: 'UPDATE "public"."bannedUser" SET "reason" = \'\' WHERE "reason" IS NULL',
          },
        ],
        postcheck: [
          {
            description: 'verify no "reason" is left null',
            sql: 'SELECT NOT EXISTS (SELECT 1 FROM "public"."bannedUser" WHERE "reason" IS NULL) AS "result"',
          },
        ],
      }),
      this.setNotNull({ schema: 'public', table: 'bannedUser', column: 'reason' }),
      this.createIndex({
        schema: 'public',
        table: 'company',
        index: 'company_active_idx_8af4daed',
        columns: ['active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'users',
        foreignKey: {
          name: 'users_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'company', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
