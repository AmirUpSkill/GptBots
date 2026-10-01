import "server-only";

import { withDb, type Database } from "../db";
import { createContactsRepository } from "../db/repositories/contacts.repository";
import { createContactInquiriesRepository } from "../db/repositories/contact-inquiries.repository";
import type { DatabaseExecutor } from "../db/repositories/types";
import type { ContactInquiry } from "../db/schema";
import type { ContactSubmissionDto } from "../dto/contact-submission.dto";
import { SubmissionConflictError } from "./errors";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ServiceDatabase = Database | Transaction;

export type ContactSubmissionResult = {
  contactId: string;
  inquiryId: string;
  submittedAt: Date;
  reused: boolean;
};

// Internal control flow: throw to roll back any contact changes before
// resolving the winner of a concurrent submission outside that transaction.
class ConcurrentSubmissionError extends Error {}

function resultFrom(inquiry: ContactInquiry, reused: boolean): ContactSubmissionResult {
  return {
    contactId: inquiry.contactId,
    inquiryId: inquiry.id,
    submittedAt: inquiry.submittedAt,
    reused,
  };
}

async function reuseSubmission(
  executor: DatabaseExecutor,
  inquiry: ContactInquiry,
  dto: ContactSubmissionDto,
): Promise<ContactSubmissionResult> {
  const contact = await createContactsRepository(executor).findById(inquiry.contactId);
  if (!contact) {
    throw new Error("Saved inquiry has no associated contact.");
  }

  // Mutable names and organization are not part of retry identity. An exact
  // original-payload comparison would require a stored snapshot/fingerprint.
  if (
    contact.email !== dto.email ||
    inquiry.inquiryType !== dto.inquiryType ||
    inquiry.message !== dto.message
  ) {
    throw new SubmissionConflictError();
  }

  return resultFrom(inquiry, true);
}

// Accepts a client or transaction for composition and integration testing.
// The caller owns connection lifetime. Input must already be parsed by Zod.
export function createContactSubmissionService(database: ServiceDatabase) {
  return {
    async submitContactInquiry(dto: ContactSubmissionDto): Promise<ContactSubmissionResult> {
      try {
        return await database.transaction(async (transaction) => {
          const contacts = createContactsRepository(transaction);
          const inquiries = createContactInquiriesRepository(transaction);
          const existing = await inquiries.findBySubmissionKey(dto.submissionKey);

          if (existing) {
            return reuseSubmission(transaction, existing, dto);
          }

          const contact = await contacts.upsertByEmail({
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            organizationName: dto.organizationName,
          });

          const inquiry = await inquiries.create({
            contactId: contact.id,
            inquiryType: dto.inquiryType,
            message: dto.message,
            submissionKey: dto.submissionKey,
          });

          if (!inquiry) {
            throw new ConcurrentSubmissionError();
          }

          return resultFrom(inquiry, false);
        }, { isolationLevel: "read committed" });
      } catch (error) {
        if (!(error instanceof ConcurrentSubmissionError)) throw error;

        // At READ COMMITTED, this fresh query sees the committed winner.
        // The losing upsert has already been rolled back.
        const existing = await createContactInquiriesRepository(database)
          .findBySubmissionKey(dto.submissionKey);

        if (!existing) {
          throw new Error("Concurrent submission could not be resolved.");
        }

        return reuseSubmission(database, existing, dto);
      }
    },
  };
}

// Entry point for the API: acquire and close the request-scoped connection.
export async function submitContactInquiry(
  dto: ContactSubmissionDto,
): Promise<ContactSubmissionResult> {
  return withDb((database) =>
    createContactSubmissionService(database).submitContactInquiry(dto),
  );
}
