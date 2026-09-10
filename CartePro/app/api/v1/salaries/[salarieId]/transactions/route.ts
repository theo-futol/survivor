import { randomUUID } from 'node:crypto';
import { db } from '@/lib/prisma/db';
import { z } from 'zod';
import { withTransaction } from '@/lib/services/postgres_client';
import { AppError, commonErrorHandler } from '@/lib/services/error_service';
import { authorize } from '@/lib/services/auth_service';
import { assertCanAccessSalarie, assertOwnsCompany, resolveActor } from '@/lib/services/ownership_service';
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
  type: z.enum(['PAYMENT', 'REFUND', 'TOPUP']),
  content: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid content format not matching SHA-256 hash'),
  companyId: z.uuid(),
});

/**
 * @openapi
 * /api/v1/salaries/{salarieId}/transactions:
 *   get:
 *     tags:
 *       - Transactions
 *     summary: Historique des transactions d'un salarié
 *     description: "Retourne les transactions paginées d'un salarié, de la plus récente à la plus ancienne. Un `ADMIN` peut consulter n'importe quel salarié, une entreprise `COMPANY` uniquement ses propres salariés, et un `EMPLOYEE` uniquement ses propres opérations."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant du salarié"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: "Numéro de la page"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: "Nombre de transactions par page"
 *     responses:
 *       '200':
 *         description: Transactions du salarié récupérées avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - transactions
 *                 - meta
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TransactionDetail'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMetaB'
 *       '400':
 *         description: Identifiant de salarié invalide ou paramètres de pagination incorrects.
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
 *         description: "Rôle insuffisant ou tentative de consulter les transactions d'un autre salarié."
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
export async function GET(request: Request, { params }: { params: Promise<{ salarieId: string }> })
{
    try {
        const auth = await authorize(request, 'GET /api/v1/salaries/:salarieId/transactions');

        if (!auth.ok) {
            return Response.json({ error: auth.error }, { status: auth.status });
        }

        const { salarieId } = await salaryParamsSchema.parseAsync(await params).catch((error) => {
            console.error('Invalid parameters', JSON.stringify(error));
            throw new AppError('Invalid parameters', 400);
        });

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
 *     tags:
 *       - Transactions
 *     summary: Encaissement d'une transaction par scan QR code
 *     description: "Encaisse un QR code de paiement présenté par le salarié. Le corps porte le hash SHA-256 du code scanné (`content`) et l'identifiant du partenaire marchand (`companyId`) ; le QR code doit appartenir au salarié visé, à cette entreprise partenaire, et ne pas être expiré. Le solde est lu sous verrou atomique (`SELECT … FOR UPDATE`) puis recalculé dans une seule transaction PostgreSQL : un `PAYMENT` débite le solde, tandis que `REFUND` et `TOPUP` le créditent. Si le solde final devient négatif, la transaction est enregistrée avec le statut `REFUSER` sans modifier le solde (réponse 201). Un QR code validé (statut `VALIDER`) est immédiatement consommé (supprimé) pour empêcher tout rejeu."
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: salarieId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identifiant du salarié bénéficiaire"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - type
 *               - content
 *               - companyId
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *                 description: "Montant en centimes d'euro (ex: 1500 pour 15,00 €)"
 *                 example: 1500
 *               type:
 *                 type: string
 *                 enum: [PAYMENT, REFUND, TOPUP]
 *                 description: "Type de transaction"
 *                 example: "PAYMENT"
 *               content:
 *                 type: string
 *                 pattern: '^[a-fA-F0-9]{64}$'
 *                 description: "Empreinte SHA-256 (64 caractères hexadécimaux) du code QR scanné"
 *                 example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *               companyId:
 *                 type: string
 *                 format: uuid
 *                 description: "Identifiant de l'entreprise partenaire réceptrice"
 *                 example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *     responses:
 *       '201':
 *         description: Transaction traitée avec succès (statut VALIDER ou REFUSER).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - message
 *                 - newBalance
 *                 - status
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Transaction created successfully"
 *                 newBalance:
 *                   type: integer
 *                   description: "Nouveau solde du salarié en centimes d'euro"
 *                   example: 10500
 *                 status:
 *                   type: string
 *                   enum: [VALIDER, REFUSER]
 *                   description: "Résultat du traitement de la transaction"
 *                   example: "VALIDER"
 *                 companyId:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *                   example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *       '400':
 *         description: "Identifiant ou corps de requête invalide, ou QR code expiré."
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
 *         description: "Rôle insuffisant ou QR code émis pour un autre salarié / une autre entreprise."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Salarié ou QR code introuvable.
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

        const requestBody = await request.json().catch(() => {
            throw new AppError('Invalid JSON in request body', 400);
        });

        const { amount, type, content, companyId } = await transactionBodySchema.parseAsync(requestBody).catch((error) => {
            console.error('Invalid request body', JSON.stringify(error));
            throw new AppError('Invalid request body', 400);
        });

        if (auth.role === 'PARTNER') {
            assertOwnsCompany(await resolveActor(auth), companyId);
        }

        // The ledger stores integer cents (int4 column), so a decimal amount is
        // rounded to the nearest cent before it ever reaches a balance computation
        // or the INSERT below.
        const amountCents = Math.round(amount);

        const ledgerCompanyId = type === 'TOPUP' ? null : companyId;

        const { newBalance, status } = await withTransaction(async (client) => {
            const locked = await client.query<{ balance: number }>(
                'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
                [salarieId],
            );

            if (locked.rowCount === 0) {
                throw new AppError('Salarie not found', 404);
            }

            const qrcodes = await client.query<{ id: number; userId: string; companyId: string; expiredAt: string }>(
                'SELECT id, "userId", "companyId", "expiredAt" FROM "qrCode" WHERE content = $1 FOR UPDATE',
                [content],
            );
            const qrcode = qrcodes.rows[0];

            if (!qrcode) {
                throw new AppError('QrCode not found', 404);
            }
            if (qrcode.userId !== salarieId) {
                throw new AppError('QrCode does not belong to this salarie', 403);
            }
            if (qrcode.companyId !== companyId) {
                throw new AppError('QrCode does not belong to this company', 403);
            }
            if (new Date(qrcode.expiredAt).getTime() <= Date.now()) {
                throw new AppError('QrCode expired', 400);
            }

            const currentBalance: number = Number(locked.rows[0]!.balance);
            const projectedBalance: number = type === 'PAYMENT' ? currentBalance - amountCents : currentBalance + amountCents;
            const authorizeOverdraft: number = 0;

            const status = projectedBalance < authorizeOverdraft ? 'REFUSER' as const : 'VALIDER' as const;
            const newBalance = status === 'VALIDER' ? projectedBalance : currentBalance;

            if (status === 'VALIDER') {
                await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, salarieId]);
            }

            const inserted = await client.query(
                `INSERT INTO "transaction" (id, type, "userId", "companyId", amount, "newBalance", status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [randomUUID(), type, salarieId, ledgerCompanyId, amountCents, newBalance, status],
            );
            if (inserted.rowCount === 0) {
                throw new AppError('Failed to create transaction', 500);
            }

            if (status === 'VALIDER') {
                await client.query('DELETE FROM "qrCode" WHERE id = $1', [qrcode.id]);
            }

            return { newBalance, status };
        });

        return Response.json(
            { message: 'Transaction created successfully', newBalance, status, companyId: ledgerCompanyId },
            { status: 201 },
        );
    } catch (error) {
        console.error('Error creating salary transaction', JSON.stringify(error));
        const {message, statusCode} = commonErrorHandler(error);
        return Response.json({ error: message }, { status: statusCode });
    }
}