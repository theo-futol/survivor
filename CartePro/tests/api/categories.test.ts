import { GET } from '@/app/api/v1/categories/route';
import { resetMockDb, mockTables } from '../mocks/mock-db';

beforeEach(() =>
{
  resetMockDb();
});

describe('GET /api/v1/categories', () =>
{
  it('returns every category sorted by label', async () =>
  {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      categories: [
        { id: 2, category: 'Culture' },
        { id: 1, category: 'Restauration' },
      ],
    });
  });

  it('returns an empty list when no category exists', async () =>
  {
    mockTables['CompanyCategory'] = [];

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ categories: [] });
  });
});
