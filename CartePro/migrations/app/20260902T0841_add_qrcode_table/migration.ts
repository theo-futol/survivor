#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b7dfaf2ec60dd91e35e556aca35950ee9c04c266343d45b1bfd0db6849f78bc4/contract';
import endContract from '../../snapshots/b7dfaf2ec60dd91e35e556aca35950ee9c04c266343d45b1bfd0db6849f78bc4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f8a041c779ed240911ed2b95b35d56f8955c3dc66ade7c37733a7495e1db94e5/contract';
import startContract from '../../snapshots/f8a041c779ed240911ed2b95b35d56f8955c3dc66ade7c37733a7495e1db94e5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'qrCode',
        columns: [
          col('companyId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiredAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'document',
        index: 'document_storageKey_idx_8c086641',
        columns: ['storageKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'qrCode',
        index: 'qrCode_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'qrCode',
        index: 'qrCode_content_idx_0ce5d7c9',
        columns: ['content'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'qrCode',
        index: 'qrCode_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'qrCode',
        foreignKey: {
          name: 'qrCode_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'qrCode',
        foreignKey: {
          name: 'qrCode_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'company', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
