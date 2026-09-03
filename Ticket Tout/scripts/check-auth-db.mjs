import { existsSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const configured = process.env.BETTER_AUTH_DB_PATH
const candidates = configured
  ? [path.resolve(configured)]
  : [path.join(projectRoot, "data", "app-auth.sqlite"), path.join(projectRoot, "app-auth.sqlite")]

const databasePath = candidates.find((candidate) => existsSync(candidate))

if (!databasePath) {
  console.error("Aucune base d'authentification trouvée. Créez d'abord un compte ou ouvrez la démo.")
  process.exit(1)
}

const database = new DatabaseSync(databasePath, { readOnly: true })
console.log(`Base Better Auth : ${databasePath}`)

try {
  const users = database.prepare('SELECT "id", "email", "accountType", "employeeAccess" FROM "user" ORDER BY "createdAt" DESC').all()
  const accounts = database.prepare('SELECT "userId", "providerId", "accountId" FROM "account"').all()
  console.log(`Utilisateurs : ${users.length}`)
  for (const user of users) {
    const linked = accounts.filter((account) => account.userId === user.id)
    console.log(`- ${user.email} | type=${user.accountType} | employeeAccess=${Boolean(user.employeeAccess)} | comptes=${linked.map((account) => account.providerId).join(",") || "aucun"}`)
  }
} catch (error) {
  console.error("La base existe mais son schéma n'est pas encore initialisé ou n'est pas lisible.")
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  database.close()
}
