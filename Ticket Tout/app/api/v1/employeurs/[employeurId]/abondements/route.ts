import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { authorize } from '@/lib/services/auth_service';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { assertOwnsCompany, resolveActor } from '@/lib/services/ownership_service';
import { withTransaction } from '@/lib/services/postgres_client';

const paramsSchema = z.object({ employeurId: z.uuid() });

// `type` and `comment` are validated but not persisted — no columns exist for them.
const abondementSchema = z.object({
  montant: z.number().int().positive(),
  date: z.iso.date().optional(),
  type: z.enum(['fixe', 'variable']),
  comment: z.string().max(500).regex(/^[^<>'"&]*$/).optional(),
});

/**
 * @openapi
 * /api/v1/employeurs/{employeurId}/abondements:
 *   post:
 *     summary: Abondement des salariés d'un employeur
 *     description: "Crédite le montant indiqué à chaque salarié actif de l'entreprise. L'opération se déroule dans une seule transaction PostgreSQL : les lignes des salariés sont verrouillées (`SELECT … FOR UPDATE`) avant la mise à jour des soldes, et une transaction immuable de type `TOPUP` (statut `VALIDER`) est créée pour chaque salarié crédité. Les champs `type` et `comment` sont validés mais ne sont pas persistés faute de colonnes dédiées. Un utilisateur `COMPANY` ne peut abonder que sa propre entreprise."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeurId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [montant, type]
 *             properties:
 *               montant: { type: integer, minimum: 1 }
 *               date: { type: string, format: date }
 *               type: { type: string, enum: [fixe, variable] }
 *               comment: { type: string }
 *     responses:
 *       '201':
 *         description: Abondement effectué.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 montant: { type: integer }
 *                 salariesCredites: { type: integer }
 *                 montantTotal: { type: integer }
 *       '400': { description: Identifiant ou corps de requête invalide. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou tentative d'abonder une autre entreprise. }
 *       '404': { description: Employeur introuvable, ou aucun salarié actif à créditer. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function POST(request: Request, { params }: { params: Promise<{ employeurId: string }> }) // TO DO : instead of trust employeurId from params, check that the user is authorized to credit this employer's employees through her userId -> role -> companyId
{
  try
  {
    const auth = await authorize(request, 'POST /api/v1/employeurs/:employeurId/abondements');

    if (!auth.ok)
    {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { employeurId } = paramsSchema.parse(await params);

    const actor = await resolveActor(auth);
    assertOwnsCompany(actor, employeurId);

    const body = await request.json().catch(() =>
    {
      throw new AppError('Invalid JSON in request body', 400);
    });
    const { montant } = abondementSchema.parse(body);

    const company = await db.orm.public.Company.where({ id: employeurId, isPartner: false, active: true }).first();

    if (!company)
    {
      throw new AppError('Employer not found', 404);
    }

    const creditedIds = await withTransaction(async (client) =>
    {
      // The balance comes back with the id because each ledger row has to record
      // the balance the credit produced (`transaction.newBalance` is NOT NULL).
      const locked = await client.query<{ id: string; balance: number }>(
        'SELECT id, balance FROM users WHERE "companyId" = $1 AND role = $2 AND "expiredAt" IS NULL FOR UPDATE',
        [employeurId, 'EMPLOYEE'],
      );

      if (locked.rowCount === 0)
      {
        throw new AppError('No active employee to credit', 404);
      }

      const ids = locked.rows.map((row) => row.id);

      await client.query('UPDATE users SET balance = balance + $1 WHERE id = ANY($2::text[])', [montant, ids]);

      // TOPUPs are employer funding operations. The database constraint
      // transaction_type_matches_company requires companyId to be NULL for TOPUP.
      // Keep the balance update and ledger rows in the same PostgreSQL transaction
      // so a failed history insert also rolls the balance back.
      for (const row of locked.rows)
      {
        await client.query(
          `INSERT INTO "transaction" (id, type, "userId", "companyId", amount, "newBalance", status)
           VALUES ($1, 'TOPUP', $2, NULL, $3, $4, 'VALIDER')`,
          [randomUUID(), row.id, montant, Number(row.balance) + montant],
        );
      }

      return ids;
    });

    return Response.json({
      montant,
      salariesCredites: creditedIds.length,
      montantTotal: montant * creditedIds.length,
    }, { status: 201 });
  }
  catch (error)
  {
    const { message, statusCode } = commonErrorHandler(error);
    return Response.json({ error: message }, { status: statusCode });
  }
}
