import { Pool, PoolClient } from 'pg';

declare global {
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // nombre max de connexions simultanées dans le pool
  });
}

// En dev, Next.js recharge les modules à chaud (hot reload), ce qui recréerait
// un nouveau Pool à chaque modif de fichier si on ne le stocke pas ailleurs.
// On réutilise donc l'instance existante sur globalThis si elle existe déjà.
const pgPool: Pool = process.env.NODE_ENV === 'production' ? createPool() : (globalThis._pgPool ??= createPool());


export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>
{
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
