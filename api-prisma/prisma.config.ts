import 'node:process';

import { defineConfig } from 'prisma/config';

/**
 * For Prisma's CLI only. The Worker never reads this: it builds its own
 * connection from the Hyperdrive binding or `DATABASE_URL`, see src/db.ts.
 *
 * `prisma migrate` is not used here. supabase/migrations owns the schema, and
 * prisma/schema.prisma maps onto it.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder@localhost:5432/postgres',
  },
});
