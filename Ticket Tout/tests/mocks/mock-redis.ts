// In-memory stand-in for @/lib/services/redis_service, wired in via jest.config.ts's
// moduleNameMapper so route/service code gets it transparently, without needing a
// real Redis connection during unit tests.
const bans = new Set<string>();

async function isBanned(userId: string): Promise<boolean>
{
  return bans.has(userId);
}

async function banUser(userId: string): Promise<void>
{
  bans.add(userId);
}

const redisClient = {
  connect: async () => {},
  get: async () => null,
  set: async () => {},
  on: () => redisClient,
};

export { redisClient, isBanned, banUser };
