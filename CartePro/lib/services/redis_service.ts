import { createClient } from 'redis';

const BAN_TTL_SECONDS = process.env['BAN_TTL_SECONDS'] ? parseInt(process.env['BAN_TTL_SECONDS']!, 10) : 1800;

const redisHost = process.env['REDIS_HOST'] || 'redis';
const redisPort = process.env['REDIS_PORT'] || '6379';
const redisPassword = process.env['REDIS_PASSWORD'];
const redisUrl = redisPassword
  ? `redis://:${encodeURIComponent(redisPassword)}@${redisHost}:${redisPort}`
  : `redis://${redisHost}:${redisPort}`;

const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Several React components may trigger authenticated API requests at the same
// time (header + page). Keep a single connection attempt in flight so two
// requests never call redisClient.connect() concurrently.
let redisConnectPromise: Promise<void> | null = null;

async function ensureRedisConnected(): Promise<void>
{
  if (redisClient.isReady)
  {
    return;
  }

  if (!redisConnectPromise)
  {
    redisConnectPromise = (async () =>
    {
      if (!redisClient.isOpen)
      {
        await redisClient.connect();
      }
    })().finally(() =>
    {
      redisConnectPromise = null;
    });
  }

  await redisConnectPromise;
}

async function isBanned(userId: string): Promise<boolean>
{
  await ensureRedisConnected();
  const value = await redisClient.get(`ban:${userId}`);
  return value !== null;
}

async function banUser(userId: string): Promise<void>
{
  await ensureRedisConnected();
  await redisClient.set(`ban:${userId}`, 'banned', { EX: BAN_TTL_SECONDS });
}

export { redisClient, isBanned, banUser, BAN_TTL_SECONDS };
