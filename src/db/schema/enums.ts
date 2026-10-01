import { pgEnum } from "drizzle-orm/pg-core";

import { INQUIRY_TYPES } from "../../lib/constants/inquiry-types";

export const inquiryTypeEnum = pgEnum("inquiry_type", INQUIRY_TYPES);

export type { InquiryType } from "../../lib/constants/inquiry-types";
