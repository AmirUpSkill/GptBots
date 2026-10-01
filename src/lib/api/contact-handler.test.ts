import assert from "node:assert/strict";
import test from "node:test";

import type { ContactSubmissionDto } from "../../dto/contact-submission.dto";
import { SubmissionConflictError } from "../../services/errors";
import { createContactPostHandler } from "./contact-handler";

const valid: ContactSubmissionDto = {
  firstName: "Sara",
  lastName: "Abdallah",
  email: "sara@example.com",
  organizationName: "Acme",
  inquiryType: "demo_request",
  message: "Please demonstrate GptBots.",
  submissionKey: "550e8400-e29b-41d4-a716-446655440000",
};
const saved = {
  contactId: "c905bf02-00ee-402e-a6c6-0db4939ac0c4",
  inquiryId: "f9dc03b6-ae74-4899-bc27-2b41f7cc7496",
  submittedAt: new Date("2026-10-01T12:00:00Z"),
  reused: false,
};

function request(payload: unknown): Request {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

test("returns 201 and passes normalized DTO to the service", async () => {
  let received: ContactSubmissionDto | undefined;
  const handler = createContactPostHandler(async (dto) => {
    received = dto;
    return saved;
  });
  const response = await handler(request({ ...valid, email: " SARA@EXAMPLE.COM ", firstName: " Sara " }));
  assert.equal(response.status, 201);
  assert.deepEqual(received, valid);
  assert.deepEqual(await response.json(), { data: { ...saved, submittedAt: saved.submittedAt.toISOString() } });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("returns 200 for an existing submission", async () => {
  const response = await createContactPostHandler(async () => ({ ...saved, reused: true }))(request(valid));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.reused, true);
});

test("returns 422 field errors without calling the service", async () => {
  let called = false;
  const response = await createContactPostHandler(async () => { called = true; return saved; })(
    request({ ...valid, email: "invalid", message: " " }),
  );
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.error, "validation_error");
  assert.deepEqual(body.fieldErrors.email, ["Enter a valid email address."]);
  assert.deepEqual(body.fieldErrors.message, ["Enter a message."]);
  assert.equal(called, false);
});

test("rejects unknown fields and non-object JSON without calling the service", async () => {
  let called = false;
  const handler = createContactPostHandler(async () => { called = true; return saved; });
  for (const payload of [{ ...valid, contactId: saved.contactId }, null, [], 42]) {
    const response = await handler(request(payload));
    assert.equal(response.status, 422);
    assert.ok((await response.json()).formErrors.length > 0);
  }
  assert.equal(called, false);
});

test("returns 400 for malformed or empty JSON without calling the service", async () => {
  let called = false;
  const handler = createContactPostHandler(async () => { called = true; return saved; });
  for (const body of ["{", ""]) {
    const response = await handler(new Request("http://localhost/api/contact", {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_json");
  }
  assert.equal(called, false);
});

test("returns 415 for unsupported or missing content type", async () => {
  let called = false;
  const handler = createContactPostHandler(async () => { called = true; return saved; });
  for (const headers of [new Headers({ "Content-Type": "text/plain" }), new Headers()]) {
    const response = await handler(new Request("http://localhost/api/contact", { method: "POST", headers }));
    assert.equal(response.status, 415);
  }
  assert.equal(called, false);
});

test("returns 409 for conflicting submission keys", async () => {
  const response = await createContactPostHandler(async () => { throw new SubmissionConflictError(); })(request(valid));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "submission_conflict");
});

test("returns 503 for a nested connection failure without leaking details", async (context) => {
  const logger = context.mock.method(console, "error", () => {});
  const secret = "private-connection-string";
  const failure = new Error(secret, { cause: Object.assign(new Error(secret), { code: "ECONNREFUSED" }) });
  const response = await createContactPostHandler(async () => { throw failure; })(request(valid));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "service_unavailable");
  assert.equal(JSON.stringify(logger.mock.calls).includes(secret), false);
});

test("returns 500 for unexpected failures without leaking details", async (context) => {
  const logger = context.mock.method(console, "error", () => {});
  const secret = "private-database-error";
  const response = await createContactPostHandler(async () => { throw new Error(secret); })(request(valid));
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error, "internal_error");
  assert.equal(JSON.stringify(body).includes(secret), false);
  assert.equal(JSON.stringify(logger.mock.calls).includes(secret), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
