import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

const brandFile = readFileSync(new URL("../lib/brand.ts", import.meta.url), "utf8")
const match = brandFile.match(/name:\s*"([^"]+)"/)
if (!match) throw new Error("Nom de marque introuvable dans lib/brand.ts")
const name = match[1]

const result = spawnSync(
  "grep",
  ["-Rnl", "--exclude-dir=node_modules", "--exclude-dir=.next", "--exclude=brand.ts", "--exclude=check-brand.mjs", "--exclude=*.sqlite", "--exclude=*.png", name, "."],
  { encoding: "utf8" }
)

if (result.status === 0 && result.stdout.trim()) {
  console.error(`Le nom de marque est encore écrit en dur dans :\n${result.stdout.trim()}`)
  process.exit(1)
}
if (result.status !== 0 && result.status !== 1) {
  console.error(result.stderr || "Impossible d'exécuter le contrôle de marque.")
  process.exit(result.status ?? 1)
}
console.log("OK : le nom de marque runtime n'est défini qu'une seule fois dans lib/brand.ts")
