import { z } from "zod";

const decimal = z.string().regex(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/);
const uuid = z.uuid();
export const babySchema = z.object({ name: z.string().trim().min(1).max(200), birthday: z.iso.date(), sex: z.string().trim().max(16).optional(), note: z.string().max(1_000).optional() });
export const growthSchema = z.object({ babyProfileId: uuid, measuredOn: z.iso.date(), weightKg: decimal, heightCm: decimal.optional(), headCircumferenceCm: decimal.optional(), note: z.string().max(1_000).optional() });
export const vaccineSchema = z.object({ babyProfileId: uuid, vaccineId: z.string().trim().min(1).max(200), administeredOn: z.iso.date(), place: z.string().max(1_000).optional(), batchNo: z.string().max(1_000).optional(), manufacturer: z.string().max(1_000).optional(), note: z.string().max(1_000).optional() });
export const careRecordSchema = z.object({ babyProfileId: uuid, type: z.enum(["CHECKUP", "MEDICAL_VISIT", "MEDICATION", "SUPPLEMENT", "OTHER"]), occurredAt: z.iso.datetime({ offset: true }), title: z.string().trim().min(1).max(300), provider: z.string().max(1_000).optional(), note: z.string().max(1_000).optional(), transactionAllocationId: uuid.optional() });
