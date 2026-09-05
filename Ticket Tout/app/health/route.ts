import { version } from "@/package.json";

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Vérification de l'état du service
 *     description: Endpoint de supervision sans authentification, retournant l'horodatage courant et la version déployée de l'application.
 *     servers:
 *       - url: http://localhost:3000
 *         description: Serveur de développement local
 *     responses:
 *       '200':
 *         description: Service opérationnel.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
export async function GET()
{
  return Response.json({
    timestamp: new Date().toISOString(),
    version: version,
  });
}
