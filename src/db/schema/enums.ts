import { pgEnum } from "drizzle-orm/pg-core";

export const inquiryTypeEnum = pgEnum("inquiry_type", [
  "demo_request",
  "pricing",
  "product_question",
  "partnership",
]);

export type InquiryType = (typeof inquiryTypeEnum.enumValues)[number];
