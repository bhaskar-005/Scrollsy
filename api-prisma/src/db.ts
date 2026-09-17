import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.ts';
import type { Env } from './env.ts';

export type Db = PrismaClient;

/**
 * A client per request. A Worker request gets its own isolate context and the
 * pg adapter holds a real connection, so one shared across requests is not safe.
 *
 * Connections come from Hyperdrive where it is configured, which pools them at
 * the edge. Without it, `DATABASE_URL` should be Supabase's own pooler, because
 * a Worker can open far more connections than Postgres will accept.
 */
export function connect(env: Env): Db {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('No database connection. Set the HYPERDRIVE binding or DATABASE_URL.');
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
