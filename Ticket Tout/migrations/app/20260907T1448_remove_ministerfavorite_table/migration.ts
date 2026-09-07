#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c65231faac1f674dc4f5664970871d5a9a2f35427c46207786fc0f58ef78d55c/contract';
import startContract from '../../snapshots/c65231faac1f674dc4f5664970871d5a9a2f35427c46207786fc0f58ef78d55c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ec0468b47dec1e221dce72fae2c03f3d794afcb96ce7b50bb423b99d4600aaee/contract';
import endContract from '../../snapshots/ec0468b47dec1e221dce72fae2c03f3d794afcb96ce7b50bb423b99d4600aaee/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropTable({ schema: 'public', table: 'ministerFavorite' })];
  }
}

MigrationCLI.run(import.meta.url, M);
