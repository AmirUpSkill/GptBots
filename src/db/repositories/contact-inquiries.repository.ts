import "server-only";

import { desc, eq } from "drizzle-orm";

import { contactInquiries, type ContactInquiry, type NewContactInquiry } from "../schema";
import type { DatabaseExecutor } from "./types";

export type CreateContactInquiryInput = Pick<
  NewContactInquiry,
  "contactId" | "inquiryType" | "message" | "submissionKey"
>;

export function createContactInquiriesRepository(executor: DatabaseExecutor) {
  return {
    // --- Duplicate keys return null. The service owns retry handling and rollback ---
    // --- Other database failures propagate to the caller ---
    async create(input: CreateContactInquiryInput): Promise<ContactInquiry | null> {
      const [inquiry] = await executor
        .insert(contactInquiries)
        .values({
          contactId: input.contactId,
          inquiryType: input.inquiryType,
          message: input.message,
          submissionKey: input.submissionKey,
        })
        .onConflictDoNothing({ target: contactInquiries.submissionKey })
        .returning();
      return inquiry ?? null;
    },

    async findBySubmissionKey(submissionKey: string): Promise<ContactInquiry | null> {
      const [inquiry] = await executor
        .select()
        .from(contactInquiries)
        .where(eq(contactInquiries.submissionKey, submissionKey))
        .limit(1);
      return inquiry ?? null;
    },

    async findByContactId(contactId: string): Promise<ContactInquiry[]> {
      return executor
        .select()
        .from(contactInquiries)
        .where(eq(contactInquiries.contactId, contactId))
        .orderBy(desc(contactInquiries.submittedAt), desc(contactInquiries.id));
    },
  };
}
