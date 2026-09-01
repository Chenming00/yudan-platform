import type { ActionContext, IsoDate, MoneyString } from "@/lib/types/platform";

export type CareRecordType =
  | "CHECKUP"
  | "VACCINE"
  | "MEDICAL"
  | "MEDICINE"
  | "SUPPLEMENT";

export interface CreateCareRecordInput {
  babyProfileId: string;
  type: CareRecordType;
  occurredOn: IsoDate;
  title: string;
  amount?: MoneyString;
  ledgerAllocationId?: string;
  note?: string;
}

export interface CareService {
  createRecord(context: ActionContext, input: CreateCareRecordInput): Promise<{ id: string }>;
}

