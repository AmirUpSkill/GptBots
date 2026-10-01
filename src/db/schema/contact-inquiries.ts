import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { contacts } from "./contacts";
import { inquiryTypeEnum } from "./enums";

export const contactInquiries = pgTable(
  "contact_inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    inquiryType: inquiryTypeEnum("inquiry_type").notNull(),
    message: text("message").notNull(),

    // Reuse the caller's key on retries; generate a new key for a new inquiry.
    submissionKey: uuid("submission_key").notNull().unique(),

    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("contact_inquiries_contact_id_idx").on(table.contactId),
    check(
      "contact_inquiries_message_nonempty",
      sql`length(btrim(${table.message})) > 0`,
    ),
  ],
);

export type ContactInquiry = typeof contactInquiries.$inferSelect;
export type NewContactInquiry = typeof contactInquiries.$inferInsert;
