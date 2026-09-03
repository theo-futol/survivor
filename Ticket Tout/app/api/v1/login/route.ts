import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { signToken, verifyPassword } from '@/lib/services/auth_service';

const loginSchema = z.object({
  email: z.email(),
  password: z.string()
  .min(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  .max(32, { message: "Le mot de passe ne doit pas dépasser 32 caractères." })
  .regex(/[A-Z]/, { message: "Le mot de passe doit contenir au moins une lettre majuscule." })
  .regex(/[a-z]/, { message: "Le mot de passe doit contenir au moins une lettre minuscule." })
  .regex(/[0-9]/, { message: "Le mot de passe doit contenir au moins un chiffre." })
  .regex(/[^A-Za-z0-9]/, { message: "Le mot de passe doit contenir au moins un caractère spécial." })
});

export async function POST(request: Request)
{
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success)
  {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password } = parsed.data;

  try
  {
    const user = await db.orm.public.Users.where({ email }).first();

    if (!user || !verifyPassword(password, user.password))
    {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { token, expiresIn } = await signToken({ sub: user.id, role: user.role });

    return Response.json({
      token,
      expiresIn,
      user: { id: user.id, role: user.role },
    });
  }
  catch (error)
  {
    console.error('Login error', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
