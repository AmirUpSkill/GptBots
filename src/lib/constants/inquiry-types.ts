// Shared by browser validation and the PostgreSQL enum without DB imports.
export const INQUIRY_TYPES = [
  "demo_request",
  "pricing",
  "product_question",
  "partnership",
] as const;

export type InquiryType = (typeof INQUIRY_TYPES)[number];
