This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database connection

Copy `.env.example` to `.env.local` and set `DATABASE_URL` to your Neon
PostgreSQL connection URL. Paste only the URL, without `psql` or shell quotes.
Use the development branch's pooled URL. `.env.local` stays ignored by Git.
On deployment, configure the variable through your hosting provider.

Run `pnpm db:check` to verify the connection and an interactive transaction.
The check only runs `SELECT 1`; it does not create tables or write records.
The command enables Node's `react-server` condition so the standalone script
can import the same `server-only` database module used by Next.js.

`src/db/index.ts` uses Drizzle's `neon-serverless` adapter and Neon WebSockets.
It requires the Node.js runtime, not Edge. For API routes, explicitly export
`const runtime = "nodejs"` and keep all database work inside `withDb`:

```ts
import { withDb } from "@/db";
import { sql } from "drizzle-orm";

const result = await withDb((database) => database.execute(sql`SELECT 1`));
```

`withDb` creates a pool for the operation and closes it in `finally`, including
when queries fail. Await all work inside its callback; do not return the client
or start background database work there. This keeps WebSocket connections
within the request lifetime in serverless deployments.

The exported `db` is for long-lived Node processes and is cached across
development reloads. Do not use that shared pool in serverless request handlers.
Standalone scripts that use it directly must call `await db.$client.end()` when
finished. No connection is opened merely by constructing a pool.

Table definitions and migrations will be added in the next database layer.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
