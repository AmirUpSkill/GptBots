import "server-only";

import { z } from "zod";

import { contactSubmissionSchema, type ContactSubmissionDto } from "../../dto/contact-submission.dto";
import type { ContactSubmissionResult } from "../../services/contact-submission.service";
import { SubmissionConflictError } from "../../services/errors";

type SubmitInquiry = (dto: ContactSubmissionDto) => Promise<ContactSubmissionResult>;

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isDatabaseUnavailable(error: unknown): boolean {
  const codes = new Set([
    "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
    "08000", "08001", "08003", "08004", "08006", "08007",
    "53300", "57P01", "57P02", "57P03",
  ]);
  // Drizzle wraps driver errors in cause. Inspect codes without exposing
  // raw error messages, SQL, credentials, or personal information.
  let cause: unknown = error;
  for (let depth = 0; depth < 5; depth++) {
    if (!cause || typeof cause !== "object") return false;
    const failure = cause as { code?: unknown; cause?: unknown };
    if (typeof failure.code === "string" && codes.has(failure.code)) return true;
    cause = failure.cause;
  }
  return false;
}

export function createContactPostHandler(submit: SubmitInquiry) {
  return async function POST(request: Request): Promise<Response> {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      return json({ error: "unsupported_media_type", message: "Send application/json." }, 415);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "invalid_json", message: "Request body must contain valid JSON." }, 400);
    }

    const parsed = contactSubmissionSchema.safeParse(payload);
    if (!parsed.success) {
      const { fieldErrors, formErrors } = z.flattenError(parsed.error);
      return json({ error: "validation_error", fieldErrors, formErrors }, 422);
    }

    try {
      const result = await submit(parsed.data);
      return json({
        data: {
          contactId: result.contactId,
          inquiryId: result.inquiryId,
          submittedAt: result.submittedAt.toISOString(),
          reused: result.reused,
        },
      }, result.reused ? 200 : 201);
    } catch (error) {
      if (error instanceof SubmissionConflictError) {
        return json({ error: error.code, message: error.message }, 409);
      }

      const unavailable = isDatabaseUnavailable(error);
      console.error("Contact submission failed.", {
        category: unavailable ? "database_unavailable" : "internal_error",
      });
      return json({
        error: unavailable ? "service_unavailable" : "internal_error",
        message: "Unable to save your inquiry. Please retry with the same submission key.",
      }, unavailable ? 503 : 500);
    }
  };
}
