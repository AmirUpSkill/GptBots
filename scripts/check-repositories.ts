import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const email = `repository-check-${randomUUID()}@example.invalid`;
  const submissionKey = randomUUID();
  const secondSubmissionKey = randomUUID();
  const rollback = new Error("Roll back repository check data.");
  let stage = "initialization";

  try {
    const { withDb } = await import("../src/db/index");
    const { createContactsRepository } = await import("../src/db/repositories/contacts.repository");
    const { createContactInquiriesRepository } = await import("../src/db/repositories/contact-inquiries.repository");

    await withDb(async (database) => {
      try {
        await database.transaction(async (transaction) => {
          const contacts = createContactsRepository(transaction);
          const inquiries = createContactInquiriesRepository(transaction);
          const input = {
            firstName: "Repository",
            lastName: "Check",
            email,
            organizationName: "Integration Check",
          };

          stage = "contact creation and lookup";
          assert.equal(await contacts.findByEmail(email), null);
          assert.equal(await contacts.findById(randomUUID()), null);
          const created = await contacts.upsertByEmail({ ...input, countryCode: "NG" });
          assert.equal((await contacts.findByEmail(email))?.id, created.id);
          assert.equal((await contacts.findById(created.id))?.id, created.id);

          stage = "contact upsert and country preservation";
          const updated = await contacts.upsertByEmail({ ...input, firstName: "Updated" });
          assert.equal(updated.id, created.id);
          assert.equal(updated.firstName, "Updated");
          assert.equal(updated.countryCode, "NG");
          assert.equal(updated.createdAt.getTime(), created.createdAt.getTime());
          assert.ok(updated.updatedAt.getTime() >= created.updatedAt.getTime());
          const cleared = await contacts.upsertByEmail({ ...input, countryCode: null });
          assert.equal(cleared.countryCode, null);

          stage = "inquiry creation and duplicate submission handling";
          const inquiryInput = {
            contactId: created.id,
            inquiryType: "demo_request" as const,
            message: "Please demonstrate the product.",
            submissionKey,
          };
          assert.equal(await inquiries.findBySubmissionKey(submissionKey), null);
          const inquiry = await inquiries.create(inquiryInput);
          assert.ok(inquiry);
          assert.equal(inquiry.contactId, created.id);
          assert.equal((await inquiries.findBySubmissionKey(submissionKey))?.id, inquiry.id);
          assert.equal(await inquiries.create(inquiryInput), null);
          assert.equal((await inquiries.findByContactId(created.id)).length, 1);

          stage = "preserving multiple inquiries";
          const second = await inquiries.create({
            ...inquiryInput,
            inquiryType: "pricing",
            message: "Please share pricing.",
            submissionKey: secondSubmissionKey,
          });
          assert.ok(second);
          const history = await inquiries.findByContactId(created.id);
          assert.equal(history.length, 2);
          assert.equal(history.find((row) => row.id === inquiry.id)?.message, inquiryInput.message);
          assert.deepEqual(await inquiries.findByContactId(randomUUID()), []);

          stage = "foreign-key failure propagation";
          // A savepoint keeps this expected failure from aborting the outer test.
          await assert.rejects(
            transaction.transaction(async (nested) => {
              await createContactInquiriesRepository(nested).create({
                ...inquiryInput,
                contactId: randomUUID(),
                submissionKey: randomUUID(),
              });
            }),
            (error: unknown) => {
              const failure = error as { cause?: { code?: string }; code?: string };
              return (failure.cause?.code ?? failure.code) === "23503";
            },
          );

          stage = "transaction rollback";
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }

      stage = "verifying rollback removed all test records";
      assert.equal(await createContactsRepository(database).findByEmail(email), null);
      const inquiries = createContactInquiriesRepository(database);
      assert.equal(await inquiries.findBySubmissionKey(submissionKey), null);
      assert.equal(await inquiries.findBySubmissionKey(secondSubmissionKey), null);
    });

    console.log("Repository integration checks passed; all test records were rolled back.");
  } catch {
    // Never print raw database errors, SQL parameters, or credentials.
    console.error(`Repository check failed during ${stage}. Error details withheld.`);
    process.exitCode = 1;
  }
}

void main();
