import "server-only";

import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";

neonConfig.webSocketConstructor = WebSocket;

function getConnectionString(): string {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is missing. Set it in .env.local or your deployment environment.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL URL, without the psql command or shell quotes.");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname || !url.username || !url.password || url.pathname.length <= 1
  ) {
    throw new Error("DATABASE_URL must include the PostgreSQL host, username, password, and database.");
  }

  return value;
}

export function createDatabase() {
  const pool = new Pool({
    connectionString: getConnectionString(),
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

  pool.on("error", () => {
    console.error("An idle database connection failed.");
  });

  return drizzle({ client: pool });
}

export type Database = ReturnType<typeof createDatabase>;

const globalForDatabase = globalThis as typeof globalThis & {
  gptbotsDatabase?: Database;
};

export const db = globalForDatabase.gptbotsDatabase ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.gptbotsDatabase = db;
}

export async function withDb<T>(work: (database: Database) => Promise<T>): Promise<T> {
  const database = createDatabase();

  try {
    return await work(database);
  } finally {
    await database.$client.end();
  }
}
