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
 *     summary: Consultation du solde d'un salarié
 *     description: Retourne le solde courant du salarié identifié par `id`. Un `ADMIN` consulte n'importe quel salarié, une entreprise `COMPANY` uniquement ses propres salariés, et un `EMPLOYEE` uniquement le sien.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du salarié.
 *     responses:
 *       '200':
 *         description: Solde récupéré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *       '400':
 *         description: Identifiant invalide.
 *       '401':
 *         description: Token manquant ou invalide.
 *       '403':
 *         description: Rôle insuffisant, ou tentative de consulter le solde d'un autre salarié.
 *       '404':
 *         description: Salarié introuvable.
 *       '500':
 *         description: Erreur serveur interne.
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
