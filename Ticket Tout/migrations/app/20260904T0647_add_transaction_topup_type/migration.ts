#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/638124c976294b5adcad32e5948cb2585e64480016c4287a90a3e76b3d73d33b/contract';
import startContract from '../../snapshots/638124c976294b5adcad32e5948cb2585e64480016c4287a90a3e76b3d73d33b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ddea35b058943bd356875a9e296d76f5a21fa1b8c244ff4177bbd1d166a05a12/contract';
import endContract from '../../snapshots/ddea35b058943bd356875a9e296d76f5a21fa1b8c244ff4177bbd1d166a05a12/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_type_check_7dc51aca',
      }),
      this.dropNotNull({ schema: 'public', table: 'transaction', column: 'companyId' }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_type_check_8b1dadb4',
        expression: "\"type\" IN ('PAYMENT', 'REFUND', 'TOPUP')",
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_type_matches_original',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_type_matches_original',
        expression:
          "(\"type\" = 'PAYMENT' AND \"originalTransactionId\" IS NULL) OR (\"type\" = 'REFUND' AND \"originalTransactionId\" IS NOT NULL) OR (\"type\" = 'TOPUP' AND \"originalTransactionId\" IS NULL)",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_type_matches_company',
        expression:
          "(\"type\" = 'TOPUP' AND \"companyId\" IS NULL) OR (\"type\" != 'TOPUP' AND \"companyId\" IS NOT NULL)",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
