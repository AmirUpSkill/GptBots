import { createContactPostHandler } from "@/lib/api/contact-handler";

export const runtime = "nodejs";

export const POST = createContactPostHandler(async (dto) => {
  // Load DB infrastructure only after validation, within the error boundary.
  const { submitContactInquiry } = await import("@/services/contact-submission.service");
  return submitContactInquiry(dto);
});
