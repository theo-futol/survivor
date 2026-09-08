#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/ae52a663186e0b94847c95d2a33f171c97bee5e445b9025c1419e036485a9200/contract';
import startContract from '../../snapshots/ae52a663186e0b94847c95d2a33f171c97bee5e445b9025c1419e036485a9200/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f8a041c779ed240911ed2b95b35d56f8955c3dc66ade7c37733a7495e1db94e5/contract';
import endContract from '../../snapshots/f8a041c779ed240911ed2b95b35d56f8955c3dc66ade7c37733a7495e1db94e5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_userId_fkey',
        kind: 'foreignKey',
      }),
      this.dropTable({ schema: 'public', table: 'user' }),
      this.createTable({
        schema: 'public',
        table: 'users',
        columns: [
          col('balance', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('documentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('password', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('roleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('surname', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_documentId_key',
        columns: ['documentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_roleId_idx_ffccc9a4',
        columns: ['roleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_updatedAt_idx_8c508b31',
        columns: ['updatedAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'users',
        foreignKey: {
          name: 'users_roleId_fkey',
          columns: ['roleId'],
          references: { schema: 'public', table: 'role', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'users',
        foreignKey: {
          name: 'users_documentId_fkey',
          columns: ['documentId'],
          references: { schema: 'public', table: 'document', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
