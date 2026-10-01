CREATE TYPE "public"."inquiry_type" AS ENUM('demo_request', 'pricing', 'product_question', 'partnership');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"organization_name" text NOT NULL,
	"country_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_email_unique" UNIQUE("email"),
	CONSTRAINT "contacts_email_normalized" CHECK ("contacts"."email" = lower(btrim("contacts"."email"))
          AND length("contacts"."email") > 0),
	CONSTRAINT "contacts_first_name_nonempty" CHECK (length(btrim("contacts"."first_name")) > 0),
	CONSTRAINT "contacts_last_name_nonempty" CHECK (length(btrim("contacts"."last_name")) > 0),
	CONSTRAINT "contacts_organization_nonempty" CHECK (length(btrim("contacts"."organization_name")) > 0),
	CONSTRAINT "contacts_country_code_format" CHECK ("contacts"."country_code" IS NULL
          OR "contacts"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "contact_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"inquiry_type" "inquiry_type" NOT NULL,
	"message" text NOT NULL,
	"submission_key" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_inquiries_submission_key_unique" UNIQUE("submission_key"),
	CONSTRAINT "contact_inquiries_message_nonempty" CHECK (length(btrim("contact_inquiries"."message")) > 0)
);
--> statement-breakpoint
ALTER TABLE "contact_inquiries" ADD CONSTRAINT "contact_inquiries_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_inquiries_contact_id_idx" ON "contact_inquiries" USING btree ("contact_id");