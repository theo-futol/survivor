import { z } from 'zod';
import { AppError } from '@/lib/services/error_service';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = { page: number; limit: number; offset: number };

export type PaginationMeta = { page: number; limit: number; total: number };

export function parsePagination(url: URL): Pagination
{
  const raw: Record<string, string> = {};
  const page = url.searchParams.get('page');
  const limit = url.searchParams.get('limit');

  if (page !== null)
  {
    raw['page'] = page;
  }

  if (limit !== null)
  {
    raw['limit'] = limit;
  }

  const parsed = paginationSchema.safeParse(raw);

  if (!parsed.success)
  {
    throw new AppError('Invalid pagination parameters', 400);
  }

  return {
    page: parsed.data.page,
    limit: parsed.data.limit,
    offset: (parsed.data.page - 1) * parsed.data.limit,
  };
}

export function buildMeta(pagination: Pagination, total: number): PaginationMeta
{
  return { page: pagination.page, limit: pagination.limit, total };
}
