import { getApiDocs } from "@/lib/swagger"
import Swagger from "./swagger"

export default async function SwaggerPage() {
  const spec = await getApiDocs()

  return (
    <main>
      <Swagger spec={spec} />
    </main>
  )
}
