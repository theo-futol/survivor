import { db } from '@/lib/prisma/db';

export async function GET(request: Request) {
  try {
    const transactions = await db.orm.public.Transaction.all();
    console.log(transactions);
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
