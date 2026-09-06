import { NextRequest, NextResponse } from "next/server"

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/services/auth_service"

const employeeOnly = ["/transactions", "/partners", "/history", "/credited", "/consumes"]
const companyOnly = ["/employer"]
const adminOnly = ["/admin", "/administration"]

function matches(pathname: string, routes: string[]) {
  return routes.some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`)
  )
}

function homeForRole(role: string) {
  if (role === "EMPLOYEE") return "/"
  if (role === "COMPANY") return "/employer"
  if (role === "ADMIN") return "/admin"
  return "/profile"
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const session = token ? await verifyToken(token) : null

  if (!session) {
    const loginUrl = new URL("/login", request.url)
    if (request.nextUrl.pathname !== "/") {
      loginUrl.searchParams.set("next", request.nextUrl.pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  const pathname = request.nextUrl.pathname

  if (matches(pathname, employeeOnly) && session.role !== "EMPLOYEE") {
    return NextResponse.redirect(new URL(homeForRole(session.role), request.url))
  }

  if (matches(pathname, companyOnly) && session.role !== "COMPANY") {
    return NextResponse.redirect(new URL(homeForRole(session.role), request.url))
  }

  if (matches(pathname, adminOnly) && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL(homeForRole(session.role), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/transactions/:path*",
    "/partners/:path*",
    "/history/:path*",
    "/credited/:path*",
    "/consumes/:path*",
    "/profile/:path*",
    "/employer/:path*",
    "/admin/:path*",
    "/administration/:path*",
  ],
}
