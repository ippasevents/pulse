import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var _postgresPool: Pool | undefined;
}

const createMockPool = (): Pool =>
  ({
    query: async () => ({ rows: [] }),
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
    on: () => {}
  }) as unknown as Pool;

export const createPool = (): Pool => {
  if (
    !process.env.SQL_HOST ||
    !process.env.SQL_USER ||
    !process.env.SQL_PASSWORD ||
    !process.env.SQL_DB_NAME
  ) {
    console.warn('[AI Studio] Database not connected — using mock');
    return createMockPool();
  }

  if (!global._postgresPool) {
    try {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000
      });

      global._postgresPool.on('error', (err) => {
        console.error('Unexpected error on idle SQL pool client:', err);
      });
    } catch {
      console.warn('[AI Studio] Database not connected — using mock');
      return createMockPool();
    }
  }
  return global._postgresPool;
};

const createMockDb = () => {
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({})
  };
  return new Proxy(
    {},
    {
      get: (_, prop) => (prop === 'query' ? new Proxy({}, { get: () => noOp }) : async () => [])
    }
  );
};

let db: any;
try {
  if (
    process.env.SQL_HOST &&
    process.env.SQL_USER &&
    process.env.SQL_PASSWORD &&
    process.env.SQL_DB_NAME
  ) {
    const pool = createPool();
    db = drizzle(pool, { schema });
  } else {
    console.warn('[AI Studio] Database not connected — using mock');
    db = createMockDb();
  }
} catch {
  console.warn('[AI Studio] Database not connected — using mock');
  db = createMockDb();
}

export { db };
