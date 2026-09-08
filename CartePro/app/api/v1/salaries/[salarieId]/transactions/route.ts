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
  amount: z.number().int().positive(),
  type: z.enum(['PAYMENT', 'REFUND', 'TOPUP']),
  content: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid content format not matching SHA-256 hash'),
  companyId: z.uuid(),
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
 *     summary: Création d'une transaction pour un salarié à partir de son QR code
 *     description: "Encaisse un QR code de paiement présenté par le salarié. Le corps porte le hash SHA-256 du code scanné (`content`) et l'entreprise partenaire (`companyId`) ; le QR code doit appartenir au salarié visé, à cette entreprise, et ne pas être expiré. Le solde est lu sous verrou (`SELECT … FOR UPDATE`) puis recalculé dans une seule transaction PostgreSQL : un `PAYMENT` débite, `REFUND` et `TOPUP` créditent. Un solde final négatif enregistre la transaction avec le statut `REFUSER` sans toucher au solde. Un QR code encaissé (statut `VALIDER`) est consommé (ligne supprimée), il ne peut donc pas être rejoué avant son expiration. La contrainte `transaction_type_matches_company` impose un `companyId` nul pour un `TOPUP`."
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
 *             required: [amount, type, content, companyId]
 *             properties:
 *               amount: { type: number, minimum: 1, description: Montant en centimes. }
 *               type: { type: string, enum: [PAYMENT, REFUND, TOPUP] }
 *               content: { type: string, description: Hash SHA-256 (64 caractères hexadécimaux) du code scanné. }
 *               companyId: { type: string, format: uuid }
 *     responses:
 *       '201':
 *         description: Transaction créée et solde mis à jour.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 newBalance: { type: number }
 *                 status: { type: string, enum: [REFUSER, VALIDER] }
 *                 companyId: { type: string, format: uuid }
 *       '400': { description: Identifiant ou corps de requête invalide, ou QR code expiré. }
 *       '401': { description: Token manquant ou invalide. }
 *       '403': { description: Rôle insuffisant, ou QR code émis pour un autre salarié / une autre entreprise. }
 *       '404': { description: Salarié ou QR code introuvable. }
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
            const projectedBalance: number = type === 'PAYMENT' ? currentBalance - amount : currentBalance + amount;
            const authorizeOverdraft: number = 0;

            const status = projectedBalance < authorizeOverdraft ? 'REFUSER' as const : 'VALIDER' as const;
            const newBalance = status === 'VALIDER' ? projectedBalance : currentBalance;

            if (status === 'VALIDER') {
                await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, salarieId]);
            }

            const inserted = await client.query(
                `INSERT INTO "transaction" (type, "userId", "companyId", amount, "newBalance", status)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [type, salarieId, ledgerCompanyId, amount, newBalance, status],
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