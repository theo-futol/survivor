import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { ensureAuthSchema } from "@/lib/auth-schema"

const employeeOnly = ["/", "/transactions", "/partners", "/history", "/credited", "/consumes"]
const companyOnly = ["/employer"]

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

  const currentUser = session.user as { employeeAccess?: boolean; accountType?: string }
  const employeeAccess = currentUser.employeeAccess === true
  if (isEmployeeRoute && !employeeAccess) {
    return NextResponse.redirect(new URL(currentUser.accountType === "company" ? "/employer" : "/profile", request.url))
  }

  const isCompanyRoute = companyOnly.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  )
  if (isCompanyRoute && currentUser.accountType !== "company") {
    return NextResponse.redirect(new URL("/profile", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/transactions/:path*", "/partners/:path*", "/history/:path*", "/credited/:path*", "/consumes/:path*", "/profile/:path*", "/employer/:path*", "/admin/:path*", "/administration/:path*"],
}
