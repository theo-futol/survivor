import type { Metadata } from "next"
import { getApiDocs } from "@/lib/swagger"
import Swagger from "./swagger"

export const metadata: Metadata = {
  title: "Documentation API | Carte Pro",
  description: "Documentation interactive Swagger UI des endpoints de l'API Carte Pro",
}

export default async function SwaggerPage() {
  const spec = await getApiDocs()

  return (
    <main>
      <Swagger spec={spec} />
    </main>
  )
}
