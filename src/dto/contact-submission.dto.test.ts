import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { INQUIRY_TYPES } from "../lib/constants/inquiry-types";
import { contactSubmissionSchema, type ContactSubmissionInput } from "./contact-submission.dto";

const valid: ContactSubmissionInput = {
  firstName: "Sara",
  lastName: "Abdallah",
  email: "sara@example.com",
  organizationName: "Acme",
  inquiryType: "demo_request",
  message: "Please show us GptBots.",
  submissionKey: "550e8400-e29b-41d4-a716-446655440000",
};

test("accepts a valid submission without adding database fields", () => {
  assert.deepEqual(contactSubmissionSchema.parse(valid), valid);
});

test("normalizes whitespace and email while preserving names and message lines", () => {
  const input = {
    ...valid,
    firstName: "  Sára  ",
    lastName: "  Ben Ali  ",
    email: "  SARA@EXAMPLE.COM  ",
    organizationName: "  Acme AI  ",
    message: " \nFirst line.\n\nSecond line.\n ",
  };
  assert.deepEqual(contactSubmissionSchema.parse(input), {
    ...valid,
    firstName: "Sára",
    lastName: "Ben Ali",
    organizationName: "Acme AI",
    message: "First line.\n\nSecond line.",
  });
  assert.equal(input.email, "  SARA@EXAMPLE.COM  ");
});

test("rejects each omitted required field", () => {
  for (const field of Object.keys(valid)) {
    const input: Record<string, unknown> = { ...valid };
    delete input[field];
    assert.equal(contactSubmissionSchema.safeParse(input).success, false, field);
  }
});

test("rejects whitespace-only text fields", () => {
  for (const field of ["firstName", "lastName", "email", "organizationName", "message"]) {
    assert.equal(contactSubmissionSchema.safeParse({ ...valid, [field]: " \t\n " }).success, false, field);
  }
});

test("rejects malformed email addresses", () => {
  for (const email of ["sara", "sara@", "@example.com", "sara @example.com", "sara@example..com"]) {
    assert.equal(contactSubmissionSchema.safeParse({ ...valid, email }).success, false, email);
  }
});

test("accepts exact length boundaries and rejects longer values", () => {
  for (const [field, maximum] of [
    ["firstName", 100], ["lastName", 100], ["organizationName", 200], ["message", 5_000],
  ] as const) {
    assert.equal(contactSubmissionSchema.safeParse({ ...valid, [field]: "a".repeat(maximum) }).success, true, field);
    assert.equal(contactSubmissionSchema.safeParse({ ...valid, [field]: "a".repeat(maximum + 1) }).success, false, field);
  }
  const email = `a@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(56)}.com`;
  assert.equal(email.length, 254);
  assert.equal(contactSubmissionSchema.safeParse({ ...valid, email }).success, true);
  assert.equal(contactSubmissionSchema.safeParse({ ...valid, email: `a${email}` }).success, false);
});

test("accepts supported inquiry types and rejects other values", () => {
  for (const inquiryType of INQUIRY_TYPES) {
    assert.equal(contactSubmissionSchema.safeParse({ ...valid, inquiryType }).success, true);
  }
  for (const inquiryType of ["other", "DEMO_REQUEST", "", " demo_request "]) {
    assert.equal(contactSubmissionSchema.safeParse({ ...valid, inquiryType }).success, false);
  }
});

test("rejects malformed submission UUIDs", () => {
  for (const submissionKey of ["", "not-a-uuid", "550e8400-e29b-41d4-0716-446655440000"]) {
    assert.equal(contactSubmissionSchema.safeParse({ ...valid, submissionKey }).success, false);
  }
});

test("rejects unknown and database-managed fields", () => {
  for (const field of ["countryCode", "id", "contactId", "createdAt", "updatedAt", "submittedAt", "unexpected"]) {
    const result = contactSubmissionSchema.safeParse({ ...valid, [field]: "unexpected" });
    assert.equal(result.success, false, field);
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => issue.code === "unrecognized_keys"));
    }
  }
});

test("rejects non-object payloads and does not coerce non-string fields", () => {
  for (const input of [null, undefined, [], "submission", 42]) {
    assert.equal(contactSubmissionSchema.safeParse(input).success, false);
  }
  for (const field of Object.keys(valid)) {
    for (const value of [null, 42, true, [], {}]) {
      assert.equal(contactSubmissionSchema.safeParse({ ...valid, [field]: value }).success, false, field);
    }
  }
});

test("provides field errors suitable for an API or form", () => {
  const result = contactSubmissionSchema.safeParse({ ...valid, email: "invalid", message: " " });
  assert.equal(result.success, false);
  if (!result.success) {
    const errors = z.flattenError(result.error);
    assert.deepEqual(errors.fieldErrors.email, ["Enter a valid email address."]);
    assert.deepEqual(errors.fieldErrors.message, ["Enter a message."]);
    assert.deepEqual(errors.formErrors, []);
  }
});
