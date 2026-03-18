import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL environment variable is not set");
  console.error("Set DATABASE_URL in Railway → Variables to your PostgreSQL connection string.");
  process.exit(1);
}

// Railway PostgreSQL uses SSL with a self-signed certificate.
// rejectUnauthorized: false accepts self-signed certs while still encrypting the connection.
// This is required for both Railway's internal and external PostgreSQL URLs.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
  ssl: { rejectUnauthorized: false },
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export { pool };
export const db = drizzle(pool, { schema });

// Test database connection — throws on failure so startup aborts with a clear error
export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('Database connection successful');
}
