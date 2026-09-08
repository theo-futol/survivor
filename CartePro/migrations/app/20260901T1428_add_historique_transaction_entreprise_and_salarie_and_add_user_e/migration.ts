#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4edcae4c337f670648995f1167f6043364cea1c6973e9465502baf5f37ae4ce0/contract';
import endContract from '../../snapshots/4edcae4c337f670648995f1167f6043364cea1c6973e9465502baf5f37ae4ce0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'administration',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'categoryEntreprise',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'document',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('size', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('storageKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'entreprise',
        columns: [
          col('addresse', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('agentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('categoryId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isPartenaire', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('kbisId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('motifId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('postalCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        table: 'historiqueTransactionEntreprise',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('entrepriseId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('transactionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'historiqueTransactionSalarie',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('salarieId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('transactionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'motifValidationEntreprise',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('motif', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'transaction',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('envoyeurId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('montant', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('receveurId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'userRole',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'users',
        columns: [
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
      this.addUnique({
        schema: 'public',
        table: 'categoryEntreprise',
        constraint: 'categoryEntreprise_category_key',
        columns: ['category'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'document',
        constraint: 'document_storageKey_key',
        columns: ['storageKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'entreprise',
        constraint: 'entreprise_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'entreprise',
        constraint: 'entreprise_siret_key',
        columns: ['siret'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'entreprise',
        constraint: 'entreprise_kbisId_key',
        columns: ['kbisId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'historiqueTransactionEntreprise',
        constraint: 'historiqueTransactionEntreprise_transactionId_key',
        columns: ['transactionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'historiqueTransactionSalarie',
        constraint: 'historiqueTransactionSalarie_transactionId_key',
        columns: ['transactionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'userRole',
        constraint: 'userRole_role_key',
        columns: ['role'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_documentId_key',
        columns: ['documentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'document',
        index: 'document_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entreprise',
        index: 'entreprise_agentId_idx_8d0ba4f0',
        columns: ['agentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entreprise',
        index: 'entreprise_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entreprise',
        index: 'entreprise_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entreprise',
        index: 'entreprise_motifId_idx_379b77f7',
        columns: ['motifId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entreprise',
        index: 'entreprise_updatedAt_idx_8c508b31',
        columns: ['updatedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entreprise',
        index: 'entreprise_verified_idx_1612bd14',
        columns: ['verified'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'historiqueTransactionEntreprise',
        index: 'historiqueTransactionEntreprise_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'historiqueTransactionEntreprise',
        index: 'historiqueTransactionEntreprise_entrepriseId_idx_9c02b5dc',
        columns: ['entrepriseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'historiqueTransactionEntreprise',
        index: 'historiqueTransactionEntreprise_transactionId_idx_d3180832',
        columns: ['transactionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'historiqueTransactionSalarie',
        index: 'historiqueTransactionSalarie_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'historiqueTransactionSalarie',
        index: 'historiqueTransactionSalarie_salarieId_idx_b30acedb',
        columns: ['salarieId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'historiqueTransactionSalarie',
        index: 'historiqueTransactionSalarie_transactionId_idx_d3180832',
        columns: ['transactionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_envoyeurId_idx_48e1b29b',
        columns: ['envoyeurId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transaction',
        index: 'transaction_receveurId_idx_6482bb61',
        columns: ['receveurId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_roleId_idx_ffccc9a4',
        columns: ['roleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_updatedAt_idx_8c508b31',
        columns: ['updatedAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entreprise',
        foreignKey: {
          name: 'entreprise_kbisId_fkey',
          columns: ['kbisId'],
          references: { schema: 'public', table: 'document', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entreprise',
        foreignKey: {
          name: 'entreprise_agentId_fkey',
          columns: ['agentId'],
          references: { schema: 'public', table: 'administration', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entreprise',
        foreignKey: {
          name: 'entreprise_motifId_fkey',
          columns: ['motifId'],
          references: { schema: 'public', table: 'motifValidationEntreprise', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entreprise',
        foreignKey: {
          name: 'entreprise_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'categoryEntreprise', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'historiqueTransactionEntreprise',
        foreignKey: {
          name: 'historiqueTransactionEntreprise_transactionId_fkey',
          columns: ['transactionId'],
          references: { schema: 'public', table: 'transaction', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'historiqueTransactionEntreprise',
        foreignKey: {
          name: 'historiqueTransactionEntreprise_entrepriseId_fkey',
          columns: ['entrepriseId'],
          references: { schema: 'public', table: 'entreprise', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'historiqueTransactionSalarie',
        foreignKey: {
          name: 'historiqueTransactionSalarie_transactionId_fkey',
          columns: ['transactionId'],
          references: { schema: 'public', table: 'transaction', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'historiqueTransactionSalarie',
        foreignKey: {
          name: 'historiqueTransactionSalarie_salarieId_fkey',
          columns: ['salarieId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_receveurId_fkey',
          columns: ['receveurId'],
          references: { schema: 'public', table: 'entreprise', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transaction',
        foreignKey: {
          name: 'transaction_envoyeurId_fkey',
          columns: ['envoyeurId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'users',
        foreignKey: {
          name: 'users_roleId_fkey',
          columns: ['roleId'],
          references: { schema: 'public', table: 'userRole', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'users',
        foreignKey: {
          name: 'users_documentId_fkey',
          columns: ['documentId'],
          references: { schema: 'public', table: 'document', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
