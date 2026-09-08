#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1eef2bf7aeaf0ebbfbd4923adfc4aacf5469c62ef6d7356cbc754e4a47d2aa05/contract';
import endContract from '../../snapshots/1eef2bf7aeaf0ebbfbd4923adfc4aacf5469c62ef6d7356cbc754e4a47d2aa05/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b2851c47cd1117227efd86e96cee8ee96e29028980e5dbf6948cfb863fb08514/contract';
import startContract from '../../snapshots/b2851c47cd1117227efd86e96cee8ee96e29028980e5dbf6948cfb863fb08514/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'ministerFavorite' }),
      this.createTable({
        schema: 'public',
        table: 'bannedUser',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'transaction',
        column: col('status', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'transaction', column: 'status' }),
      this.addUnique({
        schema: 'public',
        table: 'bannedUser',
        constraint: 'bannedUser_userId_key',
        columns: ['userId'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_status_check_27d38134',
        expression: "\"status\" IN ('REFUSER', 'VALIDER')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'bannedUser',
        index: 'bannedUser_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bannedUser',
        foreignKey: {
          name: 'bannedUser_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
