import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.local", quiet: true });

async function main() {
  try {
    const { withDb } = await import("../src/db/index");

    await withDb(async (database) => {
      const result = await database.execute<{ value: number }>(sql`SELECT 1 AS value`);
      if (result.rows[0]?.value !== 1) {
        throw new Error("Unexpected database response.");
      }

      await database.transaction(async (transaction) => {
        const result = await transaction.execute<{ value: number }>(sql`SELECT 1 AS value`);
        if (result.rows[0]?.value !== 1) {
          throw new Error("Unexpected transaction response.");
        }
      });
    });

    console.log("Database connection and interactive transaction check passed.");
  } catch {
    console.error("Database check failed. Check DATABASE_URL in .env.local and network access to Neon.");
    process.exitCode = 1;
  }
}

void main();
