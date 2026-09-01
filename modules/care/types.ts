import type { ActionContext, IsoDate, IsoDateTime, MoneyString } from "@/lib/types/platform";

export type CareRecordType = "CHECKUP" | "MEDICAL_VISIT" | "MEDICATION" | "SUPPLEMENT" | "OTHER";
export interface BabyProfileView { id: string; name: string; birthday: IsoDate; sex: string | null; note: string | null; }
export interface GrowthRecordView { id: string; babyProfileId: string; measuredOn: IsoDate; weightKg: MoneyString; heightCm: MoneyString | null; headCircumferenceCm: MoneyString | null; note: string | null; }
export interface VaccineRecordView { id: string; babyProfileId: string; vaccineId: string; vaccine: string; dose: string; administeredOn: IsoDate; place: string | null; batchNo: string | null; manufacturer: string | null; note: string | null; }
export interface CareRecordView { id: string; babyProfileId: string; type: CareRecordType; occurredAt: IsoDateTime; title: string; provider: string | null; note: string | null; transactionAllocationId: string | null; }
export interface CreateBabyProfileInput { name: string; birthday: string; sex?: string; note?: string; }
export interface CreateGrowthRecordInput { babyProfileId: string; measuredOn: string; weightKg: string; heightCm?: string; headCircumferenceCm?: string; note?: string; }
export interface CreateVaccineRecordInput { babyProfileId: string; vaccineId: string; administeredOn: string; place?: string; batchNo?: string; manufacturer?: string; note?: string; }
export interface CreateCareRecordInput { babyProfileId: string; type: CareRecordType; occurredAt: IsoDateTime; title: string; provider?: string; note?: string; transactionAllocationId?: string; }
export interface CareService {
  listBabies(context: ActionContext): Promise<BabyProfileView[]>;
  createBaby(context: ActionContext, input: CreateBabyProfileInput): Promise<BabyProfileView>;
  listGrowth(context: ActionContext, babyProfileId?: string): Promise<GrowthRecordView[]>;
  createGrowth(context: ActionContext, input: CreateGrowthRecordInput): Promise<GrowthRecordView>;
  listVaccines(context: ActionContext, babyProfileId?: string): Promise<VaccineRecordView[]>;
  createVaccine(context: ActionContext, input: CreateVaccineRecordInput): Promise<VaccineRecordView>;
  listRecords(context: ActionContext, babyProfileId?: string): Promise<CareRecordView[]>;
  createRecord(context: ActionContext, input: CreateCareRecordInput): Promise<CareRecordView>;
}
