import crypto from 'crypto';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { ROUTE_ROLES, type RouteKey } from '@/lib/roles-config';
import { isBanned } from '@/lib/services/redis_service';
import { db } from '@/lib/prisma/db';

export const AUTH_COOKIE_NAME = 'ticket_tout_token';

const JWT_SECRET = new TextEncoder().encode(process.env['JWT_SECRET']!);
const JWT_EXPIRES_IN_SECONDS = process.env['JWT_TTL_SECONDS'] ? parseInt(process.env['JWT_TTL_SECONDS']!, 10) : 1800;

export type AuthResult =
  | { ok: true; sub: string; role: string }
  | { ok: false; status: 401 | 403 | 503; error: string };

// Shared by the salarié POST and PATCH, so the complexity rules cannot drift
// apart between the two places a password can be chosen.
export const passwordSchema = z.string()
  .min(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  .max(32, { message: 'Le mot de passe ne doit pas dépasser 32 caractères.' })
  .regex(/[A-Z]/, { message: 'Le mot de passe doit contenir au moins une lettre majuscule.' })
  .regex(/[a-z]/, { message: 'Le mot de passe doit contenir au moins une lettre minuscule.' })
  .regex(/[0-9]/, { message: 'Le mot de passe doit contenir au moins un chiffre.' })
  .regex(/[^A-Za-z0-9]/, { message: 'Le mot de passe doit contenir au moins un caractère spécial.' });

export function hashPassword(password: string): string
{
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean
{
  const inputHash = Buffer.from(hashPassword(password), 'hex');
  const storedHash = Buffer.from(hash, 'hex');

  if (inputHash.length !== storedHash.length)
  {
    return false;
  }

  return crypto.timingSafeEqual(inputHash, storedHash);
}

export async function signToken(payload: { sub: string; role: string }): Promise<{ token: string; expiresIn: number }>
{
  const token = await new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRES_IN_SECONDS}s`)
    .sign(JWT_SECRET);

  return { token, expiresIn: JWT_EXPIRES_IN_SECONDS };
}

export async function verifyToken(token: string): Promise<{ sub: string; role: string } | null>
{
  try
  {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (typeof payload.sub !== 'string' || typeof payload['role'] !== 'string')
    {
      return null;
    }

    return { sub: payload.sub, role: payload['role'] };
  }
  catch
  {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null
{
  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader)
  {
    return null;
  }

  for (const part of cookieHeader.split(';'))
  {
    const [rawName, ...rawValue] = part.trim().split('=');

    if (rawName === name)
    {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}

export function getRequestToken(request: Request): string | null
{
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer '))
  {
    return authHeader.slice('Bearer '.length);
  }

  return readCookie(request, AUTH_COOKIE_NAME);
}

export async function authenticate(request: Request): Promise<AuthResult>
{
  const token = getRequestToken(request);

  if (!token)
  {
    return { ok: false, status: 401, error: 'Missing or invalid token' };
  }

  const payload = await verifyToken(token);

  if (!payload)
  {
    return { ok: false, status: 401, error: 'Missing or invalid token' };
  }

  try
  {
    const user = await db.orm.public.Users
      .where({ id: payload.sub })
      .select('expiredAt')
      .first();

    if (!user)
    {
      return { ok: false, status: 401, error: 'Missing or invalid token' };
    }

    if (user.expiredAt !== null)
    {
      return { ok: false, status: 403, error: 'Account inactive' };
    }
  }
  catch (databaseError)
  {
    console.error('PostgreSQL account status lookup failed', databaseError);
    return { ok: false, status: 503, error: 'Auth service temporarily unavailable' };
  }

  try
  {
    const banned = await isBanned(payload.sub);

    if (banned)
    {
      return { ok: false, status: 403, error: 'Account revoked' };
    }
  }
  catch (redisError)
  {
    // Redis accelerates token revocation, but the PostgreSQL bannedUser table
    // remains the durable source of truth. A temporary Redis outage must not
    // make every authenticated page unavailable.
    console.error('Redis ban lookup failed, falling back to PostgreSQL', redisError);

    try
    {
      const bannedUser = await db.orm.public.BannedUser.where({ userId: payload.sub }).first();

      if (bannedUser)
      {
        return { ok: false, status: 403, error: 'Account revoked' };
      }
    }
    catch (databaseError)
    {
      console.error('PostgreSQL ban fallback failed', databaseError);
      return { ok: false, status: 503, error: 'Auth service temporarily unavailable' };
    }
  }

  return { ok: true, sub: payload.sub, role: payload.role };
}

export async function authorize(request: Request, routeKey: RouteKey): Promise<AuthResult>
{
  const auth = await authenticate(request);

  if (!auth.ok)
  {
    return auth;
  }

  const allowedRoles: readonly string[] = ROUTE_ROLES[routeKey];

  if (!allowedRoles.includes(auth.role))
  {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return auth;
}
