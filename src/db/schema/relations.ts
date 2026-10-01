import { relations } from "drizzle-orm";

import { contactInquiries } from "./contact-inquiries";
import { contacts } from "./contacts";

export const contactsRelations = relations(contacts, ({ many }) => ({
  inquiries: many(contactInquiries),
}));

export const contactInquiriesRelations = relations(
  contactInquiries,
  ({ one }) => ({
    contact: one(contacts, {
      fields: [contactInquiries.contactId],
      references: [contacts.id],
    }),
  }),
);
