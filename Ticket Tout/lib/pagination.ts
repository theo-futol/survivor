import { z } from "zod";

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  page: z.coerce.number().int().positive().optional().default(1),
});

export type PaginationParams = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Parse et valide les query params `page`/`limit` d'une requête.
 * Retourne { success: true, data } ou { success: false, error } — ne throw jamais.
 */
export async function parsePaginationParams(searchParams: URLSearchParams)
{
  return paginationQuerySchema.safeParseAsync({
    limit: searchParams.get("limit") ?? undefined,
    page: searchParams.get("page") ?? undefined,
  });
}

/**
 * Calcule l'offset SQL à partir de page/limit (page 1-indexed).
 */
export function computeOffset(page: number, limit: number): number
{
  return (page - 1) * limit;
}

/**
 * Construit l'objet meta de pagination à partir du total et des params.
 */
export function buildPaginationMeta(totalCount: number, page: number, limit: number): PaginationMeta
{
  const totalPages = Math.ceil(totalCount / limit);

  return {
    page,
    limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
