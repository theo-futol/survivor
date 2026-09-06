#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3aef406a4dac1916022111ec37bec1bfd8a96403932cf52c47106189b4ae6406/contract';
import startContract from '../../snapshots/3aef406a4dac1916022111ec37bec1bfd8a96403932cf52c47106189b4ae6406/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/58ee6c51ed346c95314b55921487eb7a9979068a90cb8dca78f76f2eb3bfb82b/contract';
import endContract from '../../snapshots/58ee6c51ed346c95314b55921487eb7a9979068a90cb8dca78f76f2eb3bfb82b/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'company',
        constraint: 'company_agentId_fkey',
        kind: 'foreignKey',
      }),
      this.dropTable({ schema: 'public', table: 'administration' }),
      this.dropConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'users_documentId_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({ schema: 'public', table: 'users', constraint: 'users_documentId_key' }),
      this.dropColumn({ schema: 'public', table: 'users', column: 'documentId' }),
      this.createTable({
        schema: 'public',
        table: 'adminUser',
        columns: [col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } })],
        constraints: [primaryKey(['userId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'userRefusalReason',
        columns: [
          col('agentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('accountStatus', 'text', {
          notNull: true,
          default: lit('PENDING'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'transaction',
        column: col('newBalance', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'transaction', column: 'newBalance' }),
      this.alterColumnType({
        schema: 'public',
        table: 'company',
        column: 'agentId',
        options: {
          qualifiedTargetType: 'text',
          formatTypeExpected: 'text',
          rawTargetTypeForLabel: 'text',
        },
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'users_accountStatus_check_1773ea89',
        expression: "\"accountStatus\" IN ('PENDING', 'ACCEPTED', 'REFUSED')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'userRefusalReason',
        index: 'userRefusalReason_agentId_idx_8d0ba4f0',
        columns: ['agentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userRefusalReason',
        index: 'userRefusalReason_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userRefusalReason',
        index: 'userRefusalReason_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_accountStatus_idx_66d3289d',
        columns: ['accountStatus'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'adminUser',
        foreignKey: {
          name: 'adminUser_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'company',
        foreignKey: {
          name: 'company_agentId_fkey',
          columns: ['agentId'],
          references: { schema: 'public', table: 'adminUser', columns: ['userId'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userRefusalReason',
        foreignKey: {
          name: 'userRefusalReason_agentId_fkey',
          columns: ['agentId'],
          references: { schema: 'public', table: 'adminUser', columns: ['userId'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userRefusalReason',
        foreignKey: {
          name: 'userRefusalReason_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
