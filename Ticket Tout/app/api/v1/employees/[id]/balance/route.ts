import { db } from '@/lib/prisma/db';
import { z } from 'zod';

const balanceSchema = z.object({
  id: z.uuid(),
});

/**
 * @openapi
 * /api/v1/employees/{id}/balance:
 *   get:
 *     summary: Consultation du solde d'un salarié
 *     description: Retourne le solde courant du salarié identifié par `id`.
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
 *       '404':
 *         description: Salarié introuvable.
 *       '500':
 *         description: Erreur serveur interne.
 */
export async function GET(request: Request,{ params }: { params: Promise<{ id: string }> })
{
  const { id } = await params;
  const parsed = balanceSchema.safeParse({ id });

  if (!parsed.success) {
    return Response.json({ error: 'Invalid request parameters' }, { status: 400 });
  }

  try {
    const employee = await db.orm.public.Users.where({ id: parsed.data.id }).first();

    if (!employee) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    return Response.json({balance: employee.balance,}, { status: 200 });
  } catch (error) {
    console.error('Error fetching employee balance', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
