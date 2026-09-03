import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"
import { ensureAuthSchema } from "@/lib/auth-schema"

const handler = toNextJsHandler(auth)

export async function GET(request: Request) {
  await ensureAuthSchema()
  return handler.GET(request)
}

export async function POST(request: Request) {
  await ensureAuthSchema()
  return handler.POST(request)
}
