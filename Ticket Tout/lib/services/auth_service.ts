import crypto from 'crypto';
import { jwtVerify, SignJWT } from 'jose';
import { ROUTE_ROLES, type RouteKey } from '@/lib/roles-config';
import { isBanned } from '@/lib/services/redis_service';

const JWT_SECRET = new TextEncoder().encode(process.env['JWT_SECRET']!);
const JWT_EXPIRES_IN_SECONDS = process.env['JWT_TTL_SECONDS'] ? parseInt(process.env['JWT_TTL_SECONDS']!, 10) : 1800;

export type AuthResult =
  | { ok: true; sub: string; role: string }
  | { ok: false; status: 401 | 403 | 503; error: string };

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

export async function authorize(request: Request, routeKey: RouteKey): Promise<AuthResult>
{
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token)
  {
    return { ok: false, status: 401, error: 'Missing or invalid token' };
  }

  const payload = await verifyToken(token);

  if (!payload)
  {
    return { ok: false, status: 401, error: 'Missing or invalid token' };
  }


  try {
    const banned = await isBanned(payload.sub);

    if (banned) {
        return { ok: false, status: 403, error: 'Account revoked' };
    }
  } catch {
    return { ok: false, status: 503, error: 'Auth service temporarily unavailable' };
  }

  const allowedRoles: readonly string[] = ROUTE_ROLES[routeKey];

  if (!allowedRoles.includes(payload.role))
  {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, sub: payload.sub, role: payload.role };
}
