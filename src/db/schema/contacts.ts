import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull().unique(),
    organizationName: text("organization_name").notNull(),
    countryCode: text("country_code"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "contacts_email_normalized",
      sql`${table.email} = lower(btrim(${table.email}))
          AND length(${table.email}) > 0`,
    ),
    check(
      "contacts_first_name_nonempty",
      sql`length(btrim(${table.firstName})) > 0`,
    ),
    check(
      "contacts_last_name_nonempty",
      sql`length(btrim(${table.lastName})) > 0`,
    ),
    check(
      "contacts_organization_nonempty",
      sql`length(btrim(${table.organizationName})) > 0`,
    ),
    check(
      "contacts_country_code_format",
      sql`${table.countryCode} IS NULL
          OR ${table.countryCode} ~ '^[A-Z]{2}$'`,
    ),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
