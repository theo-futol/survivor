import { BRAND } from "@/lib/brand"

export function brandedEmailSubject(subject: string) {
  return `${BRAND.name} — ${subject}`
}

export function brandedExportFilename(label: string, extension = "csv") {
  const slug = BRAND.name.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `${slug}-${label}.${extension}`
}
