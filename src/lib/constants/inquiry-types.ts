// --- Build a Share browser <-> PostgreSQL Enum layer --
export const INQUIRY_TYPES = [
  "demo_request",
  "pricing",
  "product_question",
  "partnership",
] as const;

export type InquiryType = (typeof INQUIRY_TYPES)[number];
