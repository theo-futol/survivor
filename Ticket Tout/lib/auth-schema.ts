import { getMigrations } from "better-auth/db/migration"

import { auth } from "@/lib/auth"

let migrationPromise: Promise<void> | null = null

export function ensureAuthSchema() {
  if (!migrationPromise) {
    migrationPromise = getMigrations(auth.options)
      .then(({ runMigrations }) => runMigrations())
      .then(() => undefined)
  }
  return migrationPromise
}
