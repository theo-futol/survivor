import { db } from '@/lib/prisma/db';
import { z } from 'zod';
import { withTransaction } from '@/lib/services/postgres_client';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { authorize } from '@/lib/services/auth_service';
import { assertCanAccessSalarie, resolveActor } from '@/lib/services/ownership_service';
import {
  parsePaginationParams,
  computeOffset,
  buildPaginationMeta,
} from '@/lib/pagination';

const salaryParamsSchema = z.object({
  salarieId: z.uuid(),
});

const transactionBodySchema = z.object({
  amount: z.number().positive(),
  status: z.enum(['REFUSER', 'VALIDER']),
  type: z.enum(['PAYMENT', 'REFUND', 'TOPUP']),
});

/**
 * @openapi
 * /api/v1/salaries/{salarieId}/transactions:
 *   get:
 *     summary: Historique des transactions d'un salarié
 *     description: "Retourne les transactions paginées du salarié, de la plus récente à la plus ancienne. Un `ADMIN` consulte n'importe quel salarié, une entreprise `COMPANY` uniquement ses propres salariés, et un `EMPLOYEE` uniquement les siennes."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       '200':
 *         description: Transactions récupérées avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items: { type: object }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     totalCount: { type: integer }
 *                     totalPages: { type: integer }
 *                     hasNextPage: { type: boolean }
 *                     hasPrevPage: { type: boolean }
 *       '400': { description: Identifiant ou paramètres de requête invalides. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou tentative de consulter les transactions d'un autre salarié. }
 *       '404': { description: Salarié introuvable. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function GET(request: Request, { params }: { params: Promise<{ salarieId: string }> })
{
    try {
        const auth = await authorize(request, 'GET /api/v1/salaries/:salarieId/transactions');
<<<<<<< HEAD

=======
>>>>>>> 47fcf6f (feat: load employee data from API and database)
        if (!auth.ok) {
            return Response.json({ error: auth.error }, { status: auth.status });
        }

        const { salarieId } = await salaryParamsSchema.parseAsync(await params).catch((error) => {
            console.error('Invalid parameters', JSON.stringify(error));
            throw new AppError('Invalid parameters', 400);
        });

<<<<<<< HEAD
        const { searchParams } = new URL(request.url);

        const queryParseResult = await parsePaginationParams(searchParams);
        if (!queryParseResult.success) {
            console.error('Invalid query parameters', JSON.stringify(queryParseResult.error));
            throw new AppError('Invalid query parameters', 400);
        }
        const { limit, page } = queryParseResult.data;
        const offset = computeOffset(page, limit);

        const salarie = await db.orm.public.Users.where({ id: salarieId }).first();

        if (!salarie) {
            throw new AppError('Salarie not found', 404);
        }

        const actor = await resolveActor(auth);
        assertCanAccessSalarie(actor, salarie);

        const [transactions, totalCount] = await Promise.all([
            db.orm.public.Transaction
                .where({ userId: salarieId })
                .orderBy((u) => u.createdAt.desc())
                .limit(limit)
                .offset(offset)
                .all(),
            db.orm.public.Transaction
                .where({ userId: salarieId })
                .aggregate((a) => ({ total: a.count() })),
        ]);

        if (!transactions) {
            throw new AppError('No transactions found for this salarie', 404);
        }

        return Response.json(
            {
                transactions,
                meta: buildPaginationMeta(totalCount.total, page, limit),
            },
            { status: 200 }
        );
=======
        const salarie = await db.orm.public.Users.where({ id: salarieId, role: 'EMPLOYEE' }).first();
        if (!salarie || salarie.expiredAt !== null) {
            throw new AppError('Salarie not found', 404);
        }

        const actor = await resolveActor(auth);
        assertCanAccessSalarie(actor, salarie);

        const transactions = await db.orm.public.Transaction
            .where({ userId: salarieId })
            .orderBy((u) => u.createdAt.desc())
            .all();

        return Response.json({ transactions }, { status: 200 });
>>>>>>> 47fcf6f (feat: load employee data from API and database)
    } catch (error) {
        console.error('Error fetching salary transactions', JSON.stringify(error));
        const {message, statusCode} = commonErrorHandler(error);
        return Response.json({ error: message }, { status: statusCode });
    }
}

/**
 * @openapi
 * /api/v1/salaries/{salarieId}/transactions:
 *   post:
 *     summary: Création d'une transaction pour un salarié
 *     description: "Crée une transaction et recalcule le solde du salarié dans une transaction PostgreSQL, la ligne du salarié étant verrouillée (`SELECT … FOR UPDATE`) le temps du calcul. Un type `PAYMENT` débite le solde, tout autre type le crédite ; un statut `REFUSER` enregistre la transaction sans toucher au solde. Un solde final négatif est refusé. Le corps attendu est `{ amount, status, type }` — la gestion du `qrcode` et de `originalTransactionId` décrite dans docs/API.md n'est pas implémentée."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, status, type]
 *             properties:
 *               amount: { type: number, minimum: 1 }
 *               status: { type: string, enum: [REFUSER, VALIDER] }
 *               type: { type: string, enum: [PAYMENT, REFUND, TOPUP] }
 *     responses:
 *       '201':
 *         description: Transaction créée et solde mis à jour.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       '400': { description: Identifiant ou corps de requête invalide, ou solde insuffisant. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant. }
 *       '404': { description: Salarié introuvable. }
 *       '500': { description: Erreur serveur interne. }
 */
export async function POST(request: Request, { params }: { params: Promise<{ salarieId: string }> })
{
    try {
        const auth = await authorize(request, 'POST /api/v1/salaries/:salarieId/transactions');

        if (!auth.ok) {
            return Response.json({ error: auth.error }, { status: auth.status });
        }

        const { salarieId } = await salaryParamsSchema.parseAsync(await params).catch((error) => {
            console.error('Invalid parameters', JSON.stringify(error));
            throw new AppError('Invalid parameters', 400);
        });

        const requestBody = await request.json();

        await transactionBodySchema.parseAsync(requestBody).catch((error) => {
            console.error('Invalid request body', JSON.stringify(error));
            throw new AppError('Invalid request body', 400);
        });

        const {newBalance, status} : {newBalance: number, status: "REFUSER" | "VALIDER"} = await withTransaction(async (client) => {
            const rows = await client.query("SELECT balance FROM users WHERE id = $1 FOR UPDATE", [salarieId]);

            if (rows.rowCount === 0) {
                throw new AppError('Salarie not found', 404);
            }

            const currentBalance: number = rows.rows[0].balance;
            const newBalance: number = requestBody.type === "PAYMENT" ? currentBalance - requestBody.amount : currentBalance + requestBody.amount;

            if (newBalance < 0) {
                return {newBalance: currentBalance, "status": "REFUSER"};
            }
            await client.query("UPDATE users SET balance = $1 WHERE id = $2", [newBalance, salarieId]);
            return {newBalance, "status": "VALIDER"};
        });
        const insertResult = await db.orm.public.Transaction.create({
            userId: salarieId,
            amount: requestBody.amount,
            newBalance: newBalance,
            status: status,
            type: requestBody.type,
        });
        if (!insertResult) {
            throw new AppError('Failed to create transaction', 500);
        }
        return Response.json({ message: 'Transaction created successfully' }, { status: 201 });
    } catch (error) {
        console.error('Error creating salary transaction', JSON.stringify(error));
        const {message, statusCode} = commonErrorHandler(error);
        return Response.json({ error: message }, { status: statusCode });
    }
}
