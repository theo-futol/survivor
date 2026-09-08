import { mkdirSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import path from "node:path"

import { databasePath } from "@/lib/auth"

export const employeeContractsDirectory = path.resolve(process.cwd(), "data", "contracts")

export type EmployeeRequestStatus = "pending" | "accepted" | "refused"

export type EmployerEmployeeRequest = {
  id: string
  companyUserId: string
  companyName: string
  employeeFirstName: string
  employeeLastName: string
  employeeEmail: string
  employeePhone: string
  position: string
  contractType: string
  contractStartDate: string
  contractEndDate: string
  cardValidFrom: string
  cardValidUntil: string
  contractFileName: string
  contractStoredName: string
  contractMimeType: string
  contractSize: number
  status: EmployeeRequestStatus
  version: number
  createdAt: string
  updatedAt: string
}

function openDatabase() {
  const database = new DatabaseSync(databasePath)
  database.exec("PRAGMA journal_mode = WAL;")
  database.exec("PRAGMA busy_timeout = 5000;")
  database.exec("PRAGMA foreign_keys = ON;")
  database.exec(`
    CREATE TABLE IF NOT EXISTS employer_employee_request (
      id TEXT PRIMARY KEY,
      companyUserId TEXT NOT NULL,
      companyName TEXT NOT NULL DEFAULT '',
      employeeFirstName TEXT NOT NULL,
      employeeLastName TEXT NOT NULL,
      employeeEmail TEXT NOT NULL,
      employeePhone TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL,
      contractType TEXT NOT NULL,
      contractStartDate TEXT NOT NULL,
      contractEndDate TEXT NOT NULL,
      cardValidFrom TEXT NOT NULL,
      cardValidUntil TEXT NOT NULL,
      contractFileName TEXT NOT NULL,
      contractStoredName TEXT NOT NULL,
      contractMimeType TEXT NOT NULL,
      contractSize INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      version INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_employer_employee_request_company
      ON employer_employee_request(companyUserId, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_employer_employee_request_status
      ON employer_employee_request(status, updatedAt DESC);
  `)
  return database
}

export function ensureEmployerEmployeeStorage() {
  mkdirSync(employeeContractsDirectory, { recursive: true })
  const database = openDatabase()
  database.close()
}

function rowToRequest(row: Record<string, unknown>): EmployerEmployeeRequest {
  return {
    id: String(row.id),
    companyUserId: String(row.companyUserId),
    companyName: String(row.companyName ?? ""),
    employeeFirstName: String(row.employeeFirstName),
    employeeLastName: String(row.employeeLastName),
    employeeEmail: String(row.employeeEmail),
    employeePhone: String(row.employeePhone ?? ""),
    position: String(row.position),
    contractType: String(row.contractType),
    contractStartDate: String(row.contractStartDate),
    contractEndDate: String(row.contractEndDate),
    cardValidFrom: String(row.cardValidFrom),
    cardValidUntil: String(row.cardValidUntil),
    contractFileName: String(row.contractFileName),
    contractStoredName: String(row.contractStoredName),
    contractMimeType: String(row.contractMimeType),
    contractSize: Number(row.contractSize),
    status: String(row.status) as EmployeeRequestStatus,
    version: Number(row.version),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }
}

export function listEmployerEmployeeRequests(companyUserId: string) {
  ensureEmployerEmployeeStorage()
  const database = openDatabase()
  const rows = database
    .prepare(
      `SELECT * FROM employer_employee_request
       WHERE companyUserId = ?
       ORDER BY updatedAt DESC`
    )
    .all(companyUserId) as Record<string, unknown>[]
  database.close()
  return rows.map(rowToRequest)
}

export function getEmployerEmployeeRequest(id: string, companyUserId: string) {
  ensureEmployerEmployeeStorage()
  const database = openDatabase()
  const row = database
    .prepare(
      `SELECT * FROM employer_employee_request
       WHERE id = ? AND companyUserId = ?`
    )
    .get(id, companyUserId) as Record<string, unknown> | undefined
  database.close()
  return row ? rowToRequest(row) : null
}

export function insertEmployerEmployeeRequest(request: EmployerEmployeeRequest) {
  ensureEmployerEmployeeStorage()
  const database = openDatabase()
  database
    .prepare(
      `INSERT INTO employer_employee_request (
        id, companyUserId, companyName, employeeFirstName, employeeLastName,
        employeeEmail, employeePhone, position, contractType,
        contractStartDate, contractEndDate, cardValidFrom, cardValidUntil,
        contractFileName, contractStoredName, contractMimeType, contractSize,
        status, version, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      request.id,
      request.companyUserId,
      request.companyName,
      request.employeeFirstName,
      request.employeeLastName,
      request.employeeEmail,
      request.employeePhone,
      request.position,
      request.contractType,
      request.contractStartDate,
      request.contractEndDate,
      request.cardValidFrom,
      request.cardValidUntil,
      request.contractFileName,
      request.contractStoredName,
      request.contractMimeType,
      request.contractSize,
      request.status,
      request.version,
      request.createdAt,
      request.updatedAt
    )
  database.close()
  return request
}

export function updateEmployerEmployeeRequest(
  id: string,
  companyUserId: string,
  changes: Omit<
    EmployerEmployeeRequest,
    "id" | "companyUserId" | "companyName" | "createdAt" | "version"
  >
) {
  ensureEmployerEmployeeStorage()
  const database = openDatabase()
  database
    .prepare(
      `UPDATE employer_employee_request SET
        employeeFirstName = ?, employeeLastName = ?, employeeEmail = ?,
        employeePhone = ?, position = ?, contractType = ?,
        contractStartDate = ?, contractEndDate = ?, cardValidFrom = ?,
        cardValidUntil = ?, contractFileName = ?, contractStoredName = ?,
        contractMimeType = ?, contractSize = ?, status = ?,
        version = version + 1, updatedAt = ?
       WHERE id = ? AND companyUserId = ?`
    )
    .run(
      changes.employeeFirstName,
      changes.employeeLastName,
      changes.employeeEmail,
      changes.employeePhone,
      changes.position,
      changes.contractType,
      changes.contractStartDate,
      changes.contractEndDate,
      changes.cardValidFrom,
      changes.cardValidUntil,
      changes.contractFileName,
      changes.contractStoredName,
      changes.contractMimeType,
      changes.contractSize,
      changes.status,
      changes.updatedAt,
      id,
      companyUserId
    )
  const row = database
    .prepare(`SELECT * FROM employer_employee_request WHERE id = ? AND companyUserId = ?`)
    .get(id, companyUserId) as Record<string, unknown> | undefined
  database.close()
  return row ? rowToRequest(row) : null
}
