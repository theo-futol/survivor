import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/prisma/db';
import { AUTH_COOKIE_NAME, signToken, verifyPassword } from '@/lib/services/auth_service';

const loginSchema = z.object({
  email: z.email(),
  password: z.string()
    .min(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
    .max(32, { message: 'Le mot de passe ne doit pas dépasser 32 caractères.' })
    .regex(/[A-Z]/, { message: 'Le mot de passe doit contenir au moins une lettre majuscule.' })
    .regex(/[a-z]/, { message: 'Le mot de passe doit contenir au moins une lettre minuscule.' })
    .regex(/[0-9]/, { message: 'Le mot de passe doit contenir au moins un chiffre.' })
    .regex(/[^A-Za-z0-9]/, { message: 'Le mot de passe doit contenir au moins un caractère spécial.' }),
});

/**
 * @openapi
 * /api/v1/login:
 *   post:
 *     tags:
 *       - Authentification
 *     summary: Authentification par email et mot de passe
 *     description: "Vérifie les identifiants, retourne un token JWT et ouvre une session web sécurisée via le cookie HttpOnly `cartepro_token`. Le JWT peut être réutilisé dans le header `Authorization: Bearer <token>`."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: "8 à 32 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial."
 *                 example: "Secret123!"
 *     responses:
 *       '200':
 *         description: Authentification réussie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - token
 *                 - expiresIn
 *                 - user
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Jeton JWT
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 expiresIn:
 *                   type: integer
 *                   description: Durée de validité en secondes
 *                   example: 1800
 *                 user:
 *                   type: object
 *                   required:
 *                     - id
 *                     - role
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
 *                     role:
 *                       type: string
 *                       enum: [ADMIN, COMPANY, PARTNER, EMPLOYEE]
 *                       example: "EMPLOYEE"
 *       '400':
 *         description: Corps de requête invalide ou critères de mot de passe non respectés.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Identifiants invalides ou compte inactif.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Compte non validé (`accountStatus` différent de `ACCEPTED`), ou compte entreprise/partenaire suspendu (`Company.active = false`).
 *       '500':
 *         description: Erreur serveur interne.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export async function POST(request: Request)
{
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success)
  {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password } = parsed.data;

  try
  {
    const user = await db.orm.public.Users.where({ email }).first();

    if (!user || user.expiredAt !== null || !verifyPassword(password, user.password))
    {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // A salarié is created with a password chosen by their employer, so the
    // credentials alone are usable from the start: the account only becomes
    // live once an agent has verified it.
    if (user.accountStatus !== 'ACCEPTED')
    {
      return Response.json({ error: 'Compte non validé' }, { status: 403 });
    }

    // A suspended company/partner (`active = false`) keeps its history but its
    // own login account must be locked out, without touching accountStatus so
    // reactivating it needs no re-verification.
    if ((user.role === 'COMPANY' || user.role === 'PARTNER') && user.companyId !== null)
    {
      const company = await db.orm.public.Company.where({ id: user.companyId }).first();

      if (company && !company.active)
      {
        return Response.json({ error: 'Compte désactivé' }, { status: 403 });
      }
    }

    const { token, expiresIn } = await signToken({ sub: user.id, role: user.role });
    const response = NextResponse.json({
      token,
      expiresIn,
      user: { id: user.id, role: user.role },
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || new URL(request.url).protocol === 'https:',
      path: '/',
      maxAge: expiresIn,
    });

    return response;
  }
  catch (error)
  {
    console.error('Login error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * @openapi
 * /api/v1/login:
 *   delete:
 *     tags:
 *       - Authentification
 *     summary: Déconnexion de la session web
 *     description: "Supprime le cookie de session JWT HttpOnly (`cartepro_token`) du navigateur."
 *     responses:
 *       '200':
 *         description: Déconnexion réussie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - ok
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 */
export async function DELETE(request: Request)
{
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || new URL(request.url).protocol === 'https:',
    path: '/',
    maxAge: 0,
  });

  return response;
}
