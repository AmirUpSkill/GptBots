import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { inArray } from "drizzle-orm";

import { contactSubmissionSchema, type ContactSubmissionDto } from "../src/dto/contact-submission.dto";

config({ path: ".env.local", quiet: true });

async function main() {
  const emails: string[] = [];
  const keys: string[] = [];
  let stage = "initialization";

  function fixture(): ContactSubmissionDto {
    const email = `service-check-${randomUUID()}@example.com`;
    const submissionKey = randomUUID();
    emails.push(email);
    keys.push(submissionKey);
    return contactSubmissionSchema.parse({
      firstName: "Service",
      lastName: "Check",
      email,
      organizationName: "Integration Check",
      inquiryType: "demo_request",
      message: "Please demonstrate the product.",
      submissionKey,
    });
  }

  try {
    const { withDb } = await import("../src/db");
    const { contacts, contactInquiries } = await import("../src/db/schema");
    const { createContactsRepository } = await import("../src/db/repositories/contacts.repository");
    const { createContactInquiriesRepository } = await import("../src/db/repositories/contact-inquiries.repository");
    const { createContactSubmissionService } = await import("../src/services/contact-submission.service");
    const { SubmissionConflictError } = await import("../src/services/errors");

    await withDb(async (database) => {
      try {
        const rollback = new Error("Roll back ordinary service fixtures.");
        const dto = fixture();
        const failingNewContact = fixture();

        try {
          await database.transaction(async (transaction) => {
            const service = createContactSubmissionService(transaction);
            const contactRepo = createContactsRepository(transaction);
            const inquiryRepo = createContactInquiriesRepository(transaction);

            stage = "new submission";
            const first = await service.submitContactInquiry(dto);
            assert.equal(first.reused, false);
            assert.ok(first.submittedAt instanceof Date);
            assert.equal((await contactRepo.findByEmail(dto.email))?.id, first.contactId);
            assert.equal((await inquiryRepo.findBySubmissionKey(dto.submissionKey))?.id, first.inquiryId);

            stage = "retry without changing contact details";
            const retry = await service.submitContactInquiry({ ...dto, firstName: "Must not be saved" });
            assert.deepEqual(retry, { ...first, reused: true });
            assert.equal((await contactRepo.findById(first.contactId))?.firstName, dto.firstName);
            assert.equal((await inquiryRepo.findByContactId(first.contactId)).length, 1);

            stage = "another inquiry reusing contact and preserving country";
            await contactRepo.upsertByEmail({ ...dto, countryCode: "NG" });
            const anotherKey = randomUUID();
            keys.push(anotherKey);
            const another = await service.submitContactInquiry({
              ...dto,
              firstName: "Updated",
              inquiryType: "pricing",
              message: "Please share pricing.",
              submissionKey: anotherKey,
            });
            assert.equal(another.contactId, first.contactId);
            assert.notEqual(another.inquiryId, first.inquiryId);
            assert.equal(another.reused, false);
            assert.equal((await contactRepo.findById(first.contactId))?.countryCode, "NG");
            assert.equal((await inquiryRepo.findByContactId(first.contactId)).length, 2);

            stage = "conflicting submission keys";
            for (const changes of [
              { email: failingNewContact.email },
              { inquiryType: "partnership" as const },
              { message: "Different inquiry." },
            ]) {
              await assert.rejects(service.submitContactInquiry({ ...dto, ...changes }), SubmissionConflictError);
            }
            assert.equal(await contactRepo.findByEmail(failingNewContact.email), null);

            stage = "inquiry failure rolls back new contact";
            // Deliberately bypass validation to force a DB check violation
            // after the contact write; the public API will validate first.
            await assert.rejects(service.submitContactInquiry({ ...failingNewContact, message: "" }));
            assert.equal(await contactRepo.findByEmail(failingNewContact.email), null);
            assert.equal(await inquiryRepo.findBySubmissionKey(failingNewContact.submissionKey), null);

            stage = "inquiry failure rolls back existing contact changes";
            const before = await contactRepo.findById(first.contactId);
            const failingKey = randomUUID();
            keys.push(failingKey);
            await assert.rejects(service.submitContactInquiry({
              ...dto,
              firstName: "Must roll back",
              message: "",
              submissionKey: failingKey,
            }));
            assert.deepEqual(await contactRepo.findById(first.contactId), before);
            assert.equal(await inquiryRepo.findBySubmissionKey(failingKey), null);

            throw rollback;
          });
        } catch (error) {
          if (error !== rollback) throw error;
        }
        assert.equal(await createContactsRepository(database).findByEmail(dto.email), null);

        // Real concurrency needs separate transactions that commit, so these
        // uniquely named fixtures are removed in finally below.
        const service = createContactSubmissionService(database);
        const raced = fixture();
        const contenders = [
          { ...raced, firstName: "First contender" },
          { ...raced, firstName: "Second contender" },
        ];
        stage = "concurrent retries";
        const results = await Promise.all(contenders.map((input) => service.submitContactInquiry(input)));
        assert.equal(results.filter((result) => !result.reused).length, 1);
        assert.equal(results[0].inquiryId, results[1].inquiryId);
        assert.equal(results[0].contactId, results[1].contactId);
        const winnerIndex = results.findIndex((result) => !result.reused);
        const savedContact = await createContactsRepository(database).findById(results[0].contactId);
        assert.equal(savedContact?.firstName, contenders[winnerIndex].firstName);
        assert.equal((await createContactInquiriesRepository(database).findByContactId(results[0].contactId)).length, 1);

        stage = "concurrent conflicting key rolls back losing contact";
        const left = fixture();
        const right = { ...fixture(), submissionKey: left.submissionKey };
        const conflicts = await Promise.allSettled([
          service.submitContactInquiry(left),
          service.submitContactInquiry(right),
        ]);
        assert.equal(conflicts.filter((result) => result.status === "fulfilled").length, 1);
        assert.equal(conflicts.filter((result) => result.status === "rejected").length, 1);
        const winner = conflicts.findIndex((result) => result.status === "fulfilled");
        const winnerDto = [left, right][winner];
        const loserDto = [left, right][1 - winner];
        const rejected = conflicts[1 - winner];
        assert.equal(rejected.status, "rejected");
        if (rejected.status === "rejected") assert.ok(rejected.reason instanceof SubmissionConflictError);
        assert.equal(await createContactsRepository(database).findByEmail(loserDto.email), null);
        assert.equal((await service.submitContactInquiry(winnerDto)).reused, true);
      } finally {
        // Only remove records owned by this run's random fixture identifiers.
        const saved = await database.select({ id: contacts.id }).from(contacts)
          .where(inArray(contacts.email, emails));
        if (saved.length) {
          await database.transaction(async (transaction) => {
            const ids = saved.map((contact) => contact.id);
            await transaction.delete(contactInquiries).where(inArray(contactInquiries.contactId, ids));
            await transaction.delete(contacts).where(inArray(contacts.id, ids));
          });
        }
        assert.equal((await database.select().from(contacts).where(inArray(contacts.email, emails))).length, 0);
        assert.equal((await database.select().from(contactInquiries).where(inArray(contactInquiries.submissionKey, keys))).length, 0);
      }
    });

    console.log("Service integration checks passed, including concurrent submissions; all fixtures were removed.");
  } catch {
    // Raw database errors may contain connection strings or personal fields.
    console.error(`Service check failed during ${stage}. Error details withheld.`);
    process.exitCode = 1;
  }
}

void main();
