import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/signup"],
      disallow: ["/", "/profile", "/transactions", "/partners", "/history", "/credited", "/consumes", "/administration"],
    },
  }
}
