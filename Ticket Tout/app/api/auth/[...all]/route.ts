import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"
import { ensureAuthSchema } from "@/lib/auth-schema"

const handler = toNextJsHandler(auth)

/**
 * @openapi
 * /api/auth/{all}:
 *   get:
 *     summary: Endpoints better-auth (session, OAuth callbacks, etc.)
 *     description: Catch-all délégué à `better-auth` (`toNextJsHandler`) — couvre les routes internes de session/authentification générées par la librairie, hors du contrôle direct de l'application. Voir la documentation better-auth pour le détail des sous-routes.
 *     servers:
 *       - url: http://localhost:3000
 *         description: Serveur de développement local
 *     parameters:
 *       - in: path
 *         name: all
 *         required: true
 *         schema:
 *           type: string
 *         description: Segment de route better-auth (ex. `session`, `sign-in/email`, ...).
 *     responses:
 *       '200':
 *         description: Réponse déléguée à better-auth.
 *   post:
 *     summary: Endpoints better-auth (session, OAuth callbacks, etc.)
 *     description: Catch-all délégué à `better-auth` (`toNextJsHandler`) — couvre les routes internes de session/authentification générées par la librairie, hors du contrôle direct de l'application. Voir la documentation better-auth pour le détail des sous-routes.
 *     servers:
 *       - url: http://localhost:3000
 *         description: Serveur de développement local
 *     parameters:
 *       - in: path
 *         name: all
 *         required: true
 *         schema:
 *           type: string
 *         description: Segment de route better-auth (ex. `session`, `sign-in/email`, ...).
 *     responses:
 *       '200':
 *         description: Réponse déléguée à better-auth.
 */
export async function GET(request: Request) {
  await ensureAuthSchema()
  return handler.GET(request)
}

export async function POST(request: Request) {
  await ensureAuthSchema()
  return handler.POST(request)
}
