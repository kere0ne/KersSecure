import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export async function getPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const { env } = await getCloudflareContext({ async: true });
  const client = new PrismaClient({ adapter: new PrismaD1((env as unknown as { DB: D1Database }).DB), log: ['error'] });
  globalForPrisma.prisma = client;
  return client;
}
