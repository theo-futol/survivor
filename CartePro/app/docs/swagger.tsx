"use client"

import SwaggerUI from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"

type SwaggerProps = {
  spec: Record<string, unknown>
}

export default function Swagger({ spec }: SwaggerProps) {
  return <SwaggerUI spec={spec} />
}
