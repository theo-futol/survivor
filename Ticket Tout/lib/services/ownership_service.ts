import { db } from '@/lib/prisma/db';
import { AppError } from '@/lib/services/error_service';

export type Actor = { id: string; role: string; companyId: string | null };

export async function resolveActor(auth: { sub: string; role: string }): Promise<Actor>
{
  const user = await db.orm.public.Users.where({ id: auth.sub }).first();

  if (!user)
  {
    throw new AppError('Missing or invalid token', 401);
  }

  return { id: user.id, role: user.role, companyId: user.companyId };
}

// ADMIN may act on any company; every other role only on the one it belongs to.
export function assertOwnsCompany(actor: Actor, companyId: string): void
{
  if (actor.role === 'ADMIN')
  {
    return;
  }

  if (actor.companyId === null || actor.companyId !== companyId)
  {
    throw new AppError('Forbidden', 403);
  }
}

export function assertCanAccessSalarie(actor: Actor, salarie: { id: string; companyId: string | null }): void
{
  if (actor.role === 'ADMIN')
  {
    return;
  }

  if (actor.role === 'EMPLOYEE')
  {
    if (actor.id !== salarie.id)
    {
      throw new AppError('Forbidden', 403);
    }

    return;
  }

  assertOwnsCompany(actor, salarie.companyId ?? '');
}
