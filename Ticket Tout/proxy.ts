import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { ensureAuthSchema } from "@/lib/auth-schema"

const employeeOnly = ["/", "/transactions", "/partners", "/history", "/credited", "/consumes"]

export async function proxy(request: NextRequest) {
  await ensureAuthSchema()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    const loginUrl = new URL("/login", request.url)
    if (request.nextUrl.pathname !== "/") {
      loginUrl.searchParams.set("next", request.nextUrl.pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  const pathname = request.nextUrl.pathname
  const isEmployeeRoute = employeeOnly.some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`)
  )

  const employeeAccess = (session.user as { employeeAccess?: boolean }).employeeAccess === true
  if (isEmployeeRoute && !employeeAccess) {
    return NextResponse.redirect(new URL("/profile", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/transactions/:path*", "/partners/:path*", "/history/:path*", "/credited/:path*", "/consumes/:path*", "/profile/:path*", "/administration/:path*"],
}
