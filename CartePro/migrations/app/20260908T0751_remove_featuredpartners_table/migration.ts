#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d127b237327000f04ac0672b1ec28e8d1cef5fecb5a3ad2911466cf133bff0a3/contract';
import endContract from '../../snapshots/d127b237327000f04ac0672b1ec28e8d1cef5fecb5a3ad2911466cf133bff0a3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ec0468b47dec1e221dce72fae2c03f3d794afcb96ce7b50bb423b99d4600aaee/contract';
import startContract from '../../snapshots/ec0468b47dec1e221dce72fae2c03f3d794afcb96ce7b50bb423b99d4600aaee/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropColumn({ schema: 'public', table: 'company', column: 'isFeatured' }),
      this.dropTable({ schema: 'public', table: 'featuredPartner' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
