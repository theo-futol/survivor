import { betterAuth } from "better-auth"
import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import path from "node:path"
const defaultDatabasePath = path.resolve(process.cwd(), "data", "app-auth.sqlite")
export const databasePath = process.env.BETTER_AUTH_DB_PATH
  ? path.resolve(process.env.BETTER_AUTH_DB_PATH)
  : defaultDatabasePath

mkdirSync(path.dirname(databasePath), { recursive: true })

// Migration douce depuis l'ancien emplacement utilisé par les premières versions du prototype.
// Cela conserve les comptes si les fichiers sont mis à jour dans le même dossier de projet.
if (!process.env.BETTER_AUTH_DB_PATH && !existsSync(databasePath)) {
  const legacyDatabasePath = path.join(process.cwd(), "app-auth.sqlite")
  if (existsSync(legacyDatabasePath) && legacyDatabasePath !== databasePath) {
    copyFileSync(legacyDatabasePath, databasePath)
  }
}

const database = new DatabaseSync(databasePath)
database.exec("PRAGMA journal_mode = WAL;")
database.exec("PRAGMA busy_timeout = 5000;")
database.exec("PRAGMA foreign_keys = ON;")

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [baseURL]

export const auth = betterAuth({
  baseURL,
  database,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      accountType: {
        type: ["employee", "company", "partner"],
        required: true,
      },
      employeeAccess: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      organizationName: {
        type: "string",
        required: false,
      },
      registrationNumber: {
        type: "string",
        required: false,
      },
      phone: {
        type: "string",
        required: false,
      },
      legalRepresentative: {
        type: "string",
        required: false,
      },
      jobTitle: {
        type: "string",
        required: false,
      },
      address: {
        type: "string",
        required: false,
      },
      postalCode: {
        type: "string",
        required: false,
      },
      city: {
        type: "string",
        required: false,
      },
      partnerCategory: {
        type: "string",
        required: false,
      },
    },
  },
  trustedOrigins,
})
