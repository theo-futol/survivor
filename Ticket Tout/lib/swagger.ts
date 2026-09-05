import { createSwaggerSpec } from "next-swagger-doc"
import { version } from "@/package.json"

export async function getApiDocs() {
  return createSwaggerSpec({
    apiFolder: "app/api",

    definition: {
      openapi: "3.0.0",

      info: {
        title: "Ticket Tout API",
        description: "Documentation de l'API Ticket Tout",
        version,
      },

      servers: [
        {
          url: "https://localhost:3000",
          description: "Développement local",
        },
      ],

      components: {
        schemas: {
          HealthResponse: {
            type: "object",
            required: ["timestamp", "version"],
            properties: {
              timestamp: {
                type: "string",
                format: "date-time",
              },
              version: {
                type: "string",
              },
            },
          },
        },
      },
    },
  })
}
