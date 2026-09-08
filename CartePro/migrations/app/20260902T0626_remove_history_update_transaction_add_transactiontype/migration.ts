#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4edcae4c337f670648995f1167f6043364cea1c6973e9465502baf5f37ae4ce0/contract';
import startContract from '../../snapshots/4edcae4c337f670648995f1167f6043364cea1c6973e9465502baf5f37ae4ce0/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ae52a663186e0b94847c95d2a33f171c97bee5e445b9025c1419e036485a9200/contract';
import endContract from '../../snapshots/ae52a663186e0b94847c95d2a33f171c97bee5e445b9025c1419e036485a9200/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'historiqueTransactionEntreprise' }),
      this.dropTable({ schema: 'public', table: 'historiqueTransactionSalarie' }),

      this.dropConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_envoyeurId_fkey',
        kind: 'foreignKey',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_receveurId_fkey',
        kind: 'foreignKey',
      }),

      this.dropTable({ schema: 'public', table: 'entreprise' }),

      this.dropTable({ schema: 'public', table: 'categoryEntreprise' }),
      this.dropTable({ schema: 'public', table: 'motifValidationEntreprise' }),

      this.dropColumn({ schema: 'public', table: 'transaction', column: 'montant' }),
      this.dropIndex({ schema: 'public', table: 'transaction', index: 'transaction_envoyeurId_idx_48e1b29b' }),
      this.dropColumn({ schema: 'public', table: 'transaction', column: 'envoyeurId' }),
      this.dropIndex({ schema: 'public', table: 'transaction', index: 'transaction_receveurId_idx_6482bb61' }),
      this.dropColumn({ schema: 'public', table: 'transaction', column: 'receveurId' }),

      this.dropTable({ schema: 'public', table: 'users' }),
      this.dropTable({ schema: 'public', table: 'userRole' }),
      this.createTable({
        schema: 'public',
        table: 'company',
        columns: [
          col('address', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('agentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('categoryId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isFeatured', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('isPartner', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('kbisId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('postalCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reasonId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('siret', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('verified', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'companyCategory',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'companyValidationReason',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ministerFavorite',
        columns: [
          col('companyId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'role',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('balance', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('documentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('password', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('roleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('surname', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'transaction',
        column: col('originalTransactionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'transaction',
        column: col('amount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'transaction', column: 'amount' }),
      this.addColumn({
        schema: 'public',
        table: 'transaction',
        column: col('companyId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'transaction', column: 'companyId' }),
      this.addColumn({
        schema: 'public',
        table: 'transaction',
        column: col('type', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'transaction', column: 'type' }),
      this.addColumn({
        schema: 'public',
        table: 'transaction',
        column: col('userId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'transaction', column: 'userId' }),
      this.addUnique({
        schema: 'public',
        table: 'company',
        constraint: 'company_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'company',
        constraint: 'company_siret_key',
        columns: ['siret'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'company',
        constraint: 'company_kbisId_key',
        columns: ['kbisId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'companyCategory',
        constraint: 'companyCategory_category_key',
        columns: ['category'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ministerFavorite',
        constraint: 'ministerFavorite_companyId_key',
        columns: ['companyId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'role',
        constraint: 'role_role_key',
        columns: ['role'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_type_check_7dc51aca',
        expression: "\"type\" IN ('PAYMENT', 'REFUND')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_originalTransactionId_key',
        columns: ['originalTransactionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_documentId_key',
        columns: ['documentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'company',
        index: 'company_agentId_idx_8d0ba4f0',
        columns: ['agentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'company',
        index: 'company_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'company',
        index: 'company_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'company',
        index: 'company_reasonId_idx_6f913f5a',
        columns: ['reasonId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'company',
        index: 'company_updatedAt_idx_8c508b31',
        columns: ['updatedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'company',
        index: 'company_verified_idx_1612bd14',
        columns: ['verified'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_type_idx_b6b604ea',
        columns: ['type'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user',
        index: 'user_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user',
        index: 'user_roleId_idx_ffccc9a4',
        columns: ['roleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user',
        index: 'user_updatedAt_idx_8c508b31',
        columns: ['updatedAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'company',
        foreignKey: {
          name: 'company_kbisId_fkey',
          columns: ['kbisId'],
          references: { schema: 'public', table: 'document', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'company',
        foreignKey: {
          name: 'company_agentId_fkey',
          columns: ['agentId'],
          references: { schema: 'public', table: 'administration', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'company',
        foreignKey: {
          name: 'company_reasonId_fkey',
          columns: ['reasonId'],
          references: { schema: 'public', table: 'companyValidationReason', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'company',
        foreignKey: {
          name: 'company_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'companyCategory', columns: ['id'] },
        },
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
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'company', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_originalTransactionId_fkey',
          columns: ['originalTransactionId'],
          references: { schema: 'public', table: 'transaction', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'user',
        foreignKey: {
          name: 'user_roleId_fkey',
          columns: ['roleId'],
          references: { schema: 'public', table: 'role', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'user',
        foreignKey: {
          name: 'user_documentId_fkey',
          columns: ['documentId'],
          references: { schema: 'public', table: 'document', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'transaction',
        constraint: 'transaction_type_matches_original',
        expression:
          "(\"type\" = 'PAYMENT' AND \"originalTransactionId\" IS NULL) OR (\"type\" = 'REFUND' AND \"originalTransactionId\" IS NOT NULL)",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
