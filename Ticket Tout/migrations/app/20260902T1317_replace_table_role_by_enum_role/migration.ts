#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b2851c47cd1117227efd86e96cee8ee96e29028980e5dbf6948cfb863fb08514/contract';
import endContract from '../../snapshots/b2851c47cd1117227efd86e96cee8ee96e29028980e5dbf6948cfb863fb08514/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b7dfaf2ec60dd91e35e556aca35950ee9c04c266343d45b1bfd0db6849f78bc4/contract';
import startContract from '../../snapshots/b7dfaf2ec60dd91e35e556aca35950ee9c04c266343d45b1bfd0db6849f78bc4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'users_roleId_fkey',
        kind: 'foreignKey',
      }),
      this.dropTable({ schema: 'public', table: 'role' }),
      this.dropIndex({ schema: 'public', table: 'users', index: 'users_roleId_idx_ffccc9a4' }),
      this.dropColumn({ schema: 'public', table: 'users', column: 'roleId' }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('role', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'users', column: 'role' }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'users_role_check_0f22a2ab',
        expression: "\"role\" IN ('EMPLOYEE', 'COMPANY', 'PARTNER', 'ADMIN')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_role_idx_2c1ddf83',
        columns: ['role'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
