import { db } from '@/lib/prisma/db';
import { z } from 'zod';
import { authorize } from '@/lib/services/auth_service';
import { assertCanAccessSalarie, resolveActor } from '@/lib/services/ownership_service';
import { commonErrorHandler } from '@/lib/services/error_service';

const balanceSchema = z.object({
  id: z.uuid(),
});

/**
 * @openapi
 * /api/v1/employees/{id}/balance:
 *   get:
 *     tags:
 *       - Salariés
 *     summary: Consultation du solde d'un salarié
 *     description: "Retourne le solde disponible en temps réel du salarié désigné par son identifiant UUID (exprimé en centimes d'euro). Un `ADMIN` peut consulter n'importe quel salarié, une entreprise `COMPANY` uniquement ses salariés, et un `EMPLOYEE` uniquement son propre solde."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant UUID du salarié"
 *     responses:
 *       '200':
 *         description: Solde disponible récupéré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - balance
 *               properties:
 *                 balance:
 *                   type: integer
 *                   description: "Solde disponible en centimes d'euro (ex: 12345 pour 123,45 €)"
 *                   example: 12345
 *       '400':
 *         description: Identifiant UUID invalide.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Jeton manquant ou invalide.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: "Rôle insuffisant ou tentative de consulter le solde d'un tiers."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Salarié introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Erreur serveur interne.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export async function GET(request: Request,{ params }: { params: Promise<{ id: string }> })
{
  try {
    const auth = await authorize(request, 'GET /api/v1/employees/:id/balance');

    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const parsed = balanceSchema.safeParse({ id });

    if (!parsed.success) {
      return Response.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    const employee = await db.orm.public.Users.where({ id: parsed.data.id }).first();

    if (!employee) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    // ADMIN sees any balance; a company only its own employees, an employee only itself.
    const actor = await resolveActor(auth);
    assertCanAccessSalarie(actor, employee);

    return Response.json({balance: employee.balance,}, { status: 200 });
  } catch (error) {
    console.error('Error fetching employee balance', error);
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
