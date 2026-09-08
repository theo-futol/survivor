import { db } from '@/lib/prisma/db';
import { authorize } from '@/lib/services/auth_service';

/**
 * @openapi
 * /api/v1/admin/transactions.csv:
 *   get:
 *     summary: Export CSV de l'ensemble des transactions
 *     description: Retourne toutes les transactions au format CSV (`id;date_iso8601;employee_id;partner_id;amount_cents;status`), en pièce jointe téléchargeable. Réservé aux administrateurs.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Fichier CSV généré avec succès.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       '401':
 *         description: Token manquant ou invalide.
 *       '403':
 *         description: Rôle insuffisant.
 *       '500':
 *         description: Erreur serveur interne.
 */
export async function GET(request: Request) {
  try {
    const auth = await authorize(request, 'GET /api/v1/admin/transactions.csv');

    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const transactions = await db.orm.public.Transaction.all();
    const csvHeader = 'id;date_iso8601;employee_id;partner_id;amount_cents;status\n';
    const csvRows = transactions.map(t => `${t.id};${t.createdAt.toString()};${t.userId};${t.companyId};${t.amount};${t.status}`).join('\n');
    const csvContent = csvHeader + csvRows;
    

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="transactions.csv"',
      },
    });
  } catch (error) {
    console.error('Error generating CSV', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
