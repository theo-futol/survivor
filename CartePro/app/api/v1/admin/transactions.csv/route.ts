import { db } from '@/lib/prisma/db';
import { authorize } from '@/lib/services/auth_service';

/**
 * @openapi
 * /api/v1/admin/transactions.csv:
 *   get:
 *     tags:
 *       - Administration
 *     summary: Export comptable CSV de toutes les transactions
 *     description: "Exporte l'exhaustivité des transactions de la plateforme sous la forme d'un fichier CSV (`transactions.csv`) téléchargeable. Le fichier utilise le point-virgule comme séparateur avec l'entête : `id;date_iso8601;employee_id;partner_id;amount_cents;status`. Réservé aux administrateurs."
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: "Fichier CSV généré avec succès en pièce jointe téléchargeable."
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: "id;date_iso8601;employee_id;partner_id;amount_cents;status\nc71a3932-d17e-4629-9dc4-1b4d3752eef5;2026-09-02T12:30:00.000Z;9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d;a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11;1850;VALIDER\n"
 *       '401':
 *         description: Jeton manquant ou invalide.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Réservé aux administrateurs.
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
