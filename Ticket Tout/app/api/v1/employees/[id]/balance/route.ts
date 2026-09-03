import { db } from '@/lib/prisma/db';
import { z } from 'zod';

const balanceSchema = z.object({
  id: z.uuid(),
});

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
