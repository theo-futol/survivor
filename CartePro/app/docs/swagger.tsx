"use client"

import SwaggerUI from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"

type SwaggerProps = {
  spec: Record<string, unknown>
}

export default function Swagger({ spec }: SwaggerProps) {
  return (
    <div className="swagger-wrapper bg-white min-h-screen py-4">
      <SwaggerUI
        spec={spec}
        filter={true}
        persistAuthorization={true}
        displayRequestDuration={true}
        docExpansion="list"
        defaultModelsExpandDepth={1}
        defaultModelExpandDepth={1}
        tryItOutEnabled={true}
      />
    </div>
  )
}
