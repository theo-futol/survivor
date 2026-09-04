import { createClient } from 'redis';

const BAN_TTL_SECONDS = process.env['BAN_TTL_SECONDS'] ? parseInt(process.env['BAN_TTL_SECONDS']!, 10) : 1800;

const redisClient = createClient({
  url: process.env['REDIS_URL'],
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

let redisConnected = false;

async function ensureRedisConnected(): Promise<void>
{
  if (!redisConnected)
  {
    await redisClient.connect();
    redisConnected = true;
  }
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
