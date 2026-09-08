#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7916df1e38010f0dbfa53e0c014436dde33c19631de8f1d60d1295ea19f52332/contract';
import endContract from '../../snapshots/7916df1e38010f0dbfa53e0c014436dde33c19631de8f1d60d1295ea19f52332/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d127b237327000f04ac0672b1ec28e8d1cef5fecb5a3ad2911466cf133bff0a3/contract';
import startContract from '../../snapshots/d127b237327000f04ac0672b1ec28e8d1cef5fecb5a3ad2911466cf133bff0a3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropNotNull({ schema: 'public', table: 'company', column: 'agentId' }),
      this.dropNotNull({ schema: 'public', table: 'company', column: 'reasonId' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
