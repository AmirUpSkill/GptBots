import type { Database } from "../index";

// --- Database clients and transactions both implement these query methods. ----
export type DatabaseExecutor = Pick<Database, "select" | "insert">;
