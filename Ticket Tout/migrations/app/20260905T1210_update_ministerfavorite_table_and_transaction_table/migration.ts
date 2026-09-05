#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/61773de56ef951f1ac3d240a18433f7539dff5e104f355a4bc902b55b2d43971/contract';
import endContract from '../../snapshots/61773de56ef951f1ac3d240a18433f7539dff5e104f355a4bc902b55b2d43971/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ddea35b058943bd356875a9e296d76f5a21fa1b8c244ff4177bbd1d166a05a12/contract';
import startContract from '../../snapshots/ddea35b058943bd356875a9e296d76f5a21fa1b8c244ff4177bbd1d166a05a12/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'ministerFavorite',
        column: col('createdAt', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company',
        column: col('location', 'geometry(Geometry,4326)', {
          codecRef: { codecId: 'pg/geometry@1', typeParams: { srid: 4326 } },
        }),
      }),
      this.setNotNull({ schema: 'public', table: 'company', column: 'location' }),
      this.addColumn({
        schema: 'public',
        table: 'ministerFavorite',
        column: col('likeAmount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'ministerFavorite', column: 'likeAmount' }),
      this.addColumn({
        schema: 'public',
        table: 'ministerFavorite',
        column: col('updatedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.setNotNull({ schema: 'public', table: 'ministerFavorite', column: 'updatedAt' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
