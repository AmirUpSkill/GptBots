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

Table definitions are in `src/db/schema/`. Use `pnpm db:generate` to generate
migrations from schema changes, review the SQL in `drizzle/`, then apply it
to the configured database using `pnpm db:migrate`.

## Repositories

`src/db/repositories/` contains server-only factories for contacts and inquiries.
Pass a database client or transaction; repositories do not open connections.

```ts
import { withDb } from "@/db";
import { createContactsRepository } from "@/db/repositories/contacts.repository";

const contact = await withDb((database) =>
  createContactsRepository(database).findByEmail("sara@example.com"),
);
```

Contact operations are `findByEmail`, `findById`, and `upsertByEmail`.
Callers must supply normalized emails and validated inputs. Upserts preserve
the original ID and creation time; omitted country preserves the saved value,
while explicit `null` clears it.

Inquiry operations are `create`, `findBySubmissionKey`, and `findByContactId`.
History is ordered by submission time descending, with ID as a tie-breaker.
`create` returns `null` for an existing submission key and propagates other
database errors. The service must handle duplicate submissions, check their
identity, and roll back any surrounding contact changes when necessary.
For atomic submissions, create both repositories using the same transaction.

Run `pnpm db:check-repositories` against development Neon to check upserts,
lookups, country preservation, duplicate submissions, inquiry history,
foreign-key failure propagation, and rollback. All test writes are rolled back,
and the script verifies that no test records remain afterward.

## Contact submission service

`src/services/contact-submission.service.ts` exports `submitContactInquiry`.
Validate unknown input with the DTO first, then call the service from server
code running in the Node.js runtime:

```ts
import { contactSubmissionSchema } from "@/dto/contact-submission.dto";
import { submitContactInquiry } from "@/services/contact-submission.service";

const parsed = contactSubmissionSchema.safeParse(payload);
if (!parsed.success) {
  // Return validation errors from the API; do not call the service.
  throw parsed.error;
}
const result = await submitContactInquiry(parsed.data);
```

The service opens a request-scoped connection and atomically upserts the
contact and inserts the inquiry. It returns `contactId`, `inquiryId`,
`submittedAt`, and `reused`. Valid retries return the saved inquiry without
updating contact details. Retry identity matches email, inquiry type, and
message; it does not compare mutable names or organization. Conflicting
keys raise `SubmissionConflictError` from `src/services/errors.ts`.
Other database failures propagate for the API to handle.

Concurrent duplicate inserts roll back the losing transaction before reading
and validating the winning inquiry. No losing contact updates are committed.
`createContactSubmissionService(database)` supports composition and tests;
callers own connection lifetime and must use READ COMMITTED isolation when
passing an outer transaction.

Run `pnpm db:check-services` against development Neon. It checks new inquiries,
contact reuse, country preservation, retries, conflicting keys, failure
rollback, and real concurrent submissions. Ordinary fixtures roll back;
concurrency fixtures commit briefly and are deleted in `finally`. The script
verifies no test contacts or inquiries remain afterward.

## Getting Started

### Contact submission validation

`src/dto/contact-submission.dto.ts` exports a browser-safe Zod schema and
inferred input/output types. Call `contactSubmissionSchema.safeParse(payload)`
on incoming unknown JSON and pass only `result.data` to the service after
checking `result.success`. Use `z.flattenError(result.error)` to collect field
and form errors on failure. Unknown properties are rejected.

The DTO requires first name, last name, email, organization, inquiry type,
message, and a UUID submission key. Text is trimmed, email is lowercased, and
message line breaks are preserved. Length limits are 100 for each name, 254
for email, 200 for organization, and 5,000 for message. Country and
database-managed fields are excluded from this form's public contract.

Inquiry values are defined once in `src/lib/constants/inquiry-types.ts` and
used by both Zod and the PostgreSQL enum. Reuse the same submission key for
retries; service-layer handling and database uniqueness provide idempotency.
Run `pnpm test:dto` for validation tests; no database connection is needed.

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
