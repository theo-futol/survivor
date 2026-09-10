import { z } from 'zod';
import { point } from '@prisma/orm-extension-postgis/geojson';
import { db } from '@/lib/prisma/db';
import { AppError } from '@/lib/services/error_service';
import type { Pagination } from '@/lib/services/pagination';

// Rejects the characters that would otherwise be echoed back into HTML.
const safeText = (max: number) =>
  z.string().min(1).max(max).regex(/^[^<>'"&]*$/, { message: "Les caractères spéciaux (<, >, ', \", &) sont interdits." });

// Every non-nullable Company column is required — the illustrative body in
// docs/API.md omits several of them.
const companyBaseSchema = z.object({
  name: safeText(120),
  email: z.email(),
  siret: z.string().regex(/^\d{14}$/, { message: 'Le SIRET doit contenir exactement 14 chiffres.' }),
  kbisId: z.uuid(),
  description: safeText(500),
  address: safeText(255),
  postalCode: z.string().regex(/^\d{5}$/, { message: 'Le code postal doit contenir exactement 5 chiffres.' }),
  agentId: z.uuid(),
  reasonId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

// `verified` is deliberately absent from the creation schema: a company is
// always born unverified and only an administrator can validate it afterwards.
export const companyCreateSchema = companyBaseSchema;

export const companyPatchSchema = companyBaseSchema
  .partial()
  .extend({ verified: z.boolean().optional(), active: z.boolean().optional() })
  .refine(
    (patch) => Object.keys(patch).length > 0,
    { message: 'Le corps de la requête ne doit pas être vide.' },
  );

export type CompanyInput = z.infer<typeof companyCreateSchema>;

export type CompanyPatch = z.infer<typeof companyPatchSchema>;

export type ListCompaniesFilters = {
  isPartner: boolean;
  pagination: Pagination;
  search?: string | undefined;
  categorie?: string | undefined;
  verified?: boolean | undefined;
  // Set for non-admin callers so they only ever see their own company.
  id?: string | undefined;
  // Admin-only: also return suspended companies (active: false), otherwise
  // invisible everywhere so a suspended account could never be reactivated.
  includeInactive?: boolean | undefined;
};

async function resolveCategoryId(categorie: string): Promise<number>
{
  const category = await db.orm.public.CompanyCategory.where({ category: categorie }).first();

  if (!category)
  {
    throw new AppError('Category not found', 404);
  }

  return category.id;
}

export async function listCompanies(filters: ListCompaniesFilters)
{
  const equality: { isPartner: boolean; active?: boolean; verified?: boolean; categoryId?: number; id?: string } = {
    isPartner: filters.isPartner,
  };

  if (!filters.includeInactive)
  {
    equality.active = true;
  }

  if (filters.id !== undefined)
  {
    equality.id = filters.id;
  }

  if (filters.verified !== undefined)
  {
    equality.verified = filters.verified;
  }

  if (filters.categorie !== undefined)
  {
    equality.categoryId = await resolveCategoryId(filters.categorie);
  }

  const search = filters.search;

  const scoped = () =>
  {
    const base = db.orm.public.Company.where(equality);

    return search === undefined ? base : base.where((c) => c.name.ilike(`%${search}%`));
  };

  const { total } = await scoped().aggregate((aggregate) => ({ total: aggregate.count() }));
  const data = await scoped()
    .include('category', (category) => category.select('id', 'category'))
    .orderBy((c) => c.createdAt.desc())
    .limit(filters.pagination.limit)
    .offset(filters.pagination.offset)
    .all();

  return { data, total };
}

export async function getCompany(id: string, isPartner: boolean, includeInactive = false)
{
  const equality: { id: string; isPartner: boolean; active?: boolean } = { id, isPartner };

  if (!includeInactive)
  {
    equality.active = true;
  }

  const company = await db.orm.public.Company.where(equality).first();

  if (!company)
  {
    throw new AppError(isPartner ? 'Partner not found' : 'Employer not found', 404);
  }

  return company;
}

async function assertUnique(input: { email?: string; siret?: string; kbisId?: string }, excludeId?: string): Promise<void>
{
  const checks: { email?: string; siret?: string; kbisId?: string }[] = [];

  if (input.email !== undefined) checks.push({ email: input.email });
  if (input.siret !== undefined) checks.push({ siret: input.siret });
  if (input.kbisId !== undefined) checks.push({ kbisId: input.kbisId });

  for (const check of checks)
  {
    const existing = await db.orm.public.Company.where(check).first();

    if (existing && existing.id !== excludeId)
    {
      throw new AppError('A company with these identifiers already exists', 409);
    }
  }
}

export async function createCompany(input: CompanyInput, isPartner: boolean)
{
  await assertUnique(input);

  return db.orm.public.Company.create({
    name: input.name,
    email: input.email,
    siret: input.siret,
    kbisId: input.kbisId,
    description: input.description,
    address: input.address,
    postalCode: input.postalCode,
    agentId: input.agentId,
    reasonId: input.reasonId,
    categoryId: input.categoryId,
    location: point(input.location.lng, input.location.lat, 4326),
    // Registration never yields a verified company: an administrator reviews
    // the file and flips the flag through PATCH.
    verified: false,
    isPartner,
    active: true,
  });
}

// The account created alongside the company at registration. Employees share
// the companyId but are reviewed one by one by their employer, so the role
// filter deliberately excludes them. `updatedAt` is managed by the contract.
export async function setCompanyOwnerAccountStatus(companyId: string, accountStatus: 'ACCEPTED' | 'PENDING')
{
  await db.orm.public.Users
    .where({ companyId })
    .where((user) => user.role.in(['COMPANY', 'PARTNER']))
    .update({ accountStatus });
}

export async function updateCompany(id: string, isPartner: boolean, patch: CompanyPatch)
{
  // A suspended company is invisible under the default `active: true` lookup,
  // so reactivating it (or any other admin patch touching `active`) has to
  // look it up regardless of its current state — otherwise it could never be
  // brought back.
  await getCompany(id, isPartner, patch.active !== undefined);
  await assertUnique(patch, id);

  const { location, ...rest } = patch;
  const values = location === undefined
    ? rest
    : { ...rest, location: point(location.lng, location.lat, 4326) };

  await db.orm.public.Company.where({ id }).update(values);

  return db.orm.public.Company.where({ id }).first();
}

// Soft delete: companies are referenced by immutable transactions, so the row
// stays and is filtered out of every read instead.
export async function softDeleteCompany(id: string, isPartner: boolean): Promise<void>
{
  await getCompany(id, isPartner);
  await db.orm.public.Company.where({ id }).update({ active: false });
}
