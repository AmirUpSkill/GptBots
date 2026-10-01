import "server-only";

import { eq } from "drizzle-orm";

import { contacts, type Contact, type NewContact } from "../schema";
import type { DatabaseExecutor } from "./types";

export type UpsertContactInput = Pick<
  NewContact,
  "firstName" | "lastName" | "email" | "organizationName" | "countryCode"
>;

export function createContactsRepository(executor: DatabaseExecutor) {
  return {
    // --- The DTO/service supplies an already-normalized email ---
    async findByEmail(email: string): Promise<Contact | null> {
      const [contact] = await executor
        .select()
        .from(contacts)
        .where(eq(contacts.email, email))
        .limit(1);
      return contact ?? null;
    },

    async findById(id: string): Promise<Contact | null> {
      const [contact] = await executor
        .select()
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);
      return contact ?? null;
    },

    async upsertByEmail(input: UpsertContactInput): Promise<Contact> {
      const [contact] = await executor
        .insert(contacts)
        .values({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          organizationName: input.organizationName,
          ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
        })
        .onConflictDoUpdate({
          target: contacts.email,
          set: {
            firstName: input.firstName,
            lastName: input.lastName,
            organizationName: input.organizationName,
            updatedAt: new Date(),
            // --- Omission preserves country; explicit null clears it. ---
            ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
          },
        })
        .returning();

      if (!contact) throw new Error("Contact upsert returned no record.");
      return contact;
    },
  };
}
