#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1eef2bf7aeaf0ebbfbd4923adfc4aacf5469c62ef6d7356cbc754e4a47d2aa05/contract';
import startContract from '../../snapshots/1eef2bf7aeaf0ebbfbd4923adfc4aacf5469c62ef6d7356cbc754e4a47d2aa05/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/638124c976294b5adcad32e5948cb2585e64480016c4287a90a3e76b3d73d33b/contract';
import endContract from '../../snapshots/638124c976294b5adcad32e5948cb2585e64480016c4287a90a3e76b3d73d33b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ministerFavorite',
        columns: [
          col('companyId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ministerFavorite',
        constraint: 'ministerFavorite_companyId_key',
        columns: ['companyId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ministerFavorite',
        foreignKey: {
          name: 'ministerFavorite_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'company', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
