#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/58ee6c51ed346c95314b55921487eb7a9979068a90cb8dca78f76f2eb3bfb82b/contract';
import startContract from '../../snapshots/58ee6c51ed346c95314b55921487eb7a9979068a90cb8dca78f76f2eb3bfb82b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ff5ecc7689bd7343b15626058ece053115bb52dbeb6612d87c36042bf4f4638a/contract';
import endContract from '../../snapshots/ff5ecc7689bd7343b15626058ece053115bb52dbeb6612d87c36042bf4f4638a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'users_accountStatus_check_1773ea89',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'users_accountStatus_check_e20d3381',
        expression: "\"accountStatus\" IN ('PENDING', 'ACCEPTED', 'REFUSED', 'INACTIF')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
