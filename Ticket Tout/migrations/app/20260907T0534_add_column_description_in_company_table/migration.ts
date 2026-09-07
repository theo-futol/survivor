#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d7dd146512eb4371934bcd70e7350ddedabb6179a77af8b4701bb1201bbafe9f/contract';
import endContract from '../../snapshots/d7dd146512eb4371934bcd70e7350ddedabb6179a77af8b4701bb1201bbafe9f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ff5ecc7689bd7343b15626058ece053115bb52dbeb6612d87c36042bf4f4638a/contract';
import startContract from '../../snapshots/ff5ecc7689bd7343b15626058ece053115bb52dbeb6612d87c36042bf4f4638a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'company', column: 'description' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
