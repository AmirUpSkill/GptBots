import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local", quiet: true });

async function main() {
  const email = `api-check-${randomUUID()}@example.com`;
  const submissionKey = randomUUID();
  const payload = {
    firstName: "API",
    lastName: "Check",
    email,
    organizationName: "Integration Check",
    inquiryType: "demo_request",
    message: "Please demonstrate the product.",
    submissionKey,
  };
  const baseUrl = process.env.API_TEST_BASE_URL ?? "http://localhost:3000";
  const url = new URL("/api/contact", baseUrl);
  let stage = "initialization";

  async function post(body: unknown) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  }

  try {
    const { withDb } = await import("../src/db");
    const { contacts, contactInquiries } = await import("../src/db/schema");

    await withDb(async (database) => {
      try {
        stage = "HTTP validation";
        const invalid = await post({ ...payload, email: "invalid" });
        assert.equal(invalid.status, 422);
        assert.equal((await invalid.json()).error, "validation_error");

        stage = "HTTP creation and persistence";
        const created = await post({ ...payload, email: ` ${email.toUpperCase()} ` });
        assert.equal(created.status, 201);
        const saved = (await created.json()).data;
        assert.equal(saved.reused, false);
        assert.equal(new Date(saved.submittedAt).toISOString(), saved.submittedAt);
        const contact = await database.query.contacts.findFirst({ where: eq(contacts.email, email) });
        assert.equal(contact?.id, saved.contactId);
        const inquiry = await database.query.contactInquiries.findFirst({
          where: eq(contactInquiries.submissionKey, submissionKey),
        });
        assert.equal(inquiry?.id, saved.inquiryId);

        stage = "HTTP retry";
        const retry = await post({ ...payload, firstName: "Must not overwrite" });
        assert.equal(retry.status, 200);
        assert.deepEqual((await retry.json()).data, { ...saved, reused: true });
        const unchanged = await database.query.contacts.findFirst({ where: eq(contacts.email, email) });
        assert.equal(unchanged?.firstName, payload.firstName);

        stage = "HTTP conflict";
        const conflict = await post({ ...payload, message: "A different inquiry." });
        assert.equal(conflict.status, 409);
        assert.equal((await conflict.json()).error, "submission_conflict");

        stage = "unsupported HTTP method";
        const get = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        assert.equal(get.status, 405);
      } finally {
        // Only remove this run's uniquely identified fixture from the DB
        // configured in .env.local. The local app must use the same database.
        const contact = await database.query.contacts.findFirst({ where: eq(contacts.email, email) });
        if (contact) {
          await database.transaction(async (transaction) => {
            await transaction.delete(contactInquiries).where(eq(contactInquiries.contactId, contact.id));
            await transaction.delete(contacts).where(eq(contacts.id, contact.id));
          });
        }
        assert.equal(await database.query.contacts.findFirst({ where: eq(contacts.email, email) }), undefined);
        assert.equal(await database.query.contactInquiries.findFirst({
          where: eq(contactInquiries.submissionKey, submissionKey),
        }), undefined);
      }
    });

    console.log("Live contact API checks passed; the test fixture was removed.");
  } catch {
    console.error(`Contact API check failed during ${stage}. Check the local server and database configuration.`);
    process.exitCode = 1;
  }
}

void main();
