import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { authorize } from "@/lib/auth/authorization";
import { getDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors/app-error";
import type { ActionContext } from "@/lib/types/platform";
import { formatMoney } from "@/modules/ledger/money";
import type { CareRecordType, CreateBabyProfileInput, CreateCareRecordInput, CreateGrowthRecordInput, CreateVaccineRecordInput } from "./types";

function parsedDate(value: string, label: string) {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new AppError("VALIDATION_FAILED", `${label}格式不正确。`);
  return result;
}
function clean(value: string | null | undefined, label: string) {
  const result = value?.trim();
  if (result && result.length > 1_000) throw new AppError("VALIDATION_FAILED", `${label}不能超过 1000 个字符。`);
  return result || null;
}
function decimalValue(value: string | undefined, label: string) {
  if (!value || !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/.test(value)) {
    throw new AppError("VALIDATION_FAILED", `${label}格式不正确。`);
  }
  return new Prisma.Decimal(value);
}
async function assertBaby(context: ActionContext, id: string) {
  const baby = await getDatabase().babyProfile.findFirst({ where: { id, householdId: context.householdId }, select: { id: true } });
  if (!baby) throw new AppError("RESOURCE_NOT_FOUND", "宝宝资料不存在。" );
}

export async function listBabies(context: ActionContext) {
  await authorize({ context, permission: "care.read" });
  const rows = await getDatabase().babyProfile.findMany({ where: { householdId: context.householdId }, orderBy: { birthday: "asc" }, select: { id: true, name: true, birthday: true, sex: true, note: true } });
  return rows.map((row) => ({ ...row, birthday: row.birthday.toISOString().slice(0, 10) }));
}
export async function createBaby(context: ActionContext, input: CreateBabyProfileInput) {
  await authorize({ context, permission: "care.write" });
  if (!input.name.trim()) throw new AppError("VALIDATION_FAILED", "宝宝姓名不能为空。" );
  const row = await getDatabase().$transaction(async (tx) => {
    const created = await tx.babyProfile.create({ data: { householdId: context.householdId, name: input.name.trim().slice(0, 200), birthday: parsedDate(input.birthday, "生日"), sex: clean(input.sex, "性别"), note: clean(input.note, "备注") } });
    await writeAuditLog(tx, { action: "care.baby.created", entityType: "BabyProfile", entityId: created.id, actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId });
    return created;
  });
  return { ...row, birthday: row.birthday.toISOString().slice(0, 10) };
}
export async function listGrowth(context: ActionContext, babyProfileId?: string) {
  await authorize({ context, permission: "care.read" });
  if (babyProfileId) await assertBaby(context, babyProfileId);
  const rows = await getDatabase().growthRecord.findMany({ where: { householdId: context.householdId, ...(babyProfileId ? { babyProfileId } : {}) }, orderBy: [{ measuredOn: "desc" }, { createdAt: "desc" }] });
  return rows.map((row) => ({ id: row.id, babyProfileId: row.babyProfileId, measuredOn: row.measuredOn.toISOString().slice(0, 10), weightKg: formatMoney(row.weightKg), heightCm: row.heightCm ? formatMoney(row.heightCm) : null, headCircumferenceCm: row.headCircumferenceCm ? formatMoney(row.headCircumferenceCm) : null, note: row.note }));
}
export async function createGrowth(context: ActionContext, input: CreateGrowthRecordInput) {
  await authorize({ context, permission: "care.write" }); await assertBaby(context, input.babyProfileId);
  const weight = decimalValue(input.weightKg, "体重");
  if (weight.lessThanOrEqualTo(0) || weight.greaterThan(100)) throw new AppError("VALIDATION_FAILED", "体重必须在 0 到 100 kg 之间。" );
  const row = await getDatabase().growthRecord.create({ data: { householdId: context.householdId, babyProfileId: input.babyProfileId, measuredOn: parsedDate(input.measuredOn, "测量日期"), weightKg: weight, heightCm: input.heightCm ? decimalValue(input.heightCm, "身高") : null, headCircumferenceCm: input.headCircumferenceCm ? decimalValue(input.headCircumferenceCm, "头围") : null, note: clean(input.note, "备注") } });
  return { id: row.id, babyProfileId: row.babyProfileId, measuredOn: row.measuredOn.toISOString().slice(0, 10), weightKg: formatMoney(row.weightKg), heightCm: row.heightCm ? formatMoney(row.heightCm) : null, headCircumferenceCm: row.headCircumferenceCm ? formatMoney(row.headCircumferenceCm) : null, note: row.note };
}
export async function listVaccines(context: ActionContext, babyProfileId?: string) {
  await authorize({ context, permission: "care.read" }); if (babyProfileId) await assertBaby(context, babyProfileId);
  const rows = await getDatabase().vaccineRecord.findMany({ where: { householdId: context.householdId, ...(babyProfileId ? { babyProfileId } : {}) }, orderBy: { administeredOn: "desc" }, include: { vaccine: { select: { vaccine: true, dose: true } } } });
  return rows.map((row) => ({ id: row.id, babyProfileId: row.babyProfileId, vaccineId: row.vaccineId, vaccine: row.vaccine.vaccine, dose: row.vaccine.dose, administeredOn: row.administeredOn.toISOString().slice(0, 10), place: row.place, batchNo: row.batchNo, manufacturer: row.manufacturer, note: row.note }));
}
export async function createVaccine(context: ActionContext, input: CreateVaccineRecordInput) {
  await authorize({ context, permission: "care.write" }); await assertBaby(context, input.babyProfileId);
  const catalog = await getDatabase().vaccineCatalog.findFirst({ where: { id: input.vaccineId, active: true }, select: { id: true } });
  if (!catalog) throw new AppError("RESOURCE_NOT_FOUND", "疫苗目录不存在或已停用。" );
  try {
    const row = await getDatabase().vaccineRecord.create({ data: { householdId: context.householdId, babyProfileId: input.babyProfileId, vaccineId: input.vaccineId, administeredOn: parsedDate(input.administeredOn, "接种日期"), place: clean(input.place, "接种地点"), batchNo: clean(input.batchNo, "批号"), manufacturer: clean(input.manufacturer, "生产厂家"), note: clean(input.note, "备注") }, include: { vaccine: { select: { vaccine: true, dose: true } } } });
    return { id: row.id, babyProfileId: row.babyProfileId, vaccineId: row.vaccineId, vaccine: row.vaccine.vaccine, dose: row.vaccine.dose, administeredOn: row.administeredOn.toISOString().slice(0, 10), place: row.place, batchNo: row.batchNo, manufacturer: row.manufacturer, note: row.note };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("CONFLICT", "同一宝宝、同一疫苗和同一天已经有记录。" );
    throw error;
  }
}
export async function listRecords(context: ActionContext, babyProfileId?: string) {
  await authorize({ context, permission: "care.read" }); if (babyProfileId) await assertBaby(context, babyProfileId);
  const rows = await getDatabase().careRecord.findMany({ where: { householdId: context.householdId, ...(babyProfileId ? { babyProfileId } : {}) }, orderBy: { occurredAt: "desc" } });
  return rows.map((row) => ({ id: row.id, babyProfileId: row.babyProfileId, type: row.type as CareRecordType, occurredAt: row.occurredAt.toISOString(), title: row.title, provider: row.provider, note: row.note, transactionAllocationId: row.transactionAllocationId }));
}
export async function createCareRecord(context: ActionContext, input: CreateCareRecordInput) {
  await authorize({ context, permission: "care.write" }); await assertBaby(context, input.babyProfileId);
  if (!input.title.trim()) throw new AppError("VALIDATION_FAILED", "记录标题不能为空。" );
  const db = getDatabase();
  if (input.transactionAllocationId) {
    const allocation = await db.transactionAllocation.findFirst({ where: { id: input.transactionAllocationId, householdId: context.householdId, module: "CHILD_CARE" }, select: { id: true } });
    if (!allocation) throw new AppError("RESOURCE_NOT_FOUND", "儿童保健账本关联不存在。" );
  }
  const row = await db.$transaction(async (tx) => {
    const created = await tx.careRecord.create({ data: { householdId: context.householdId, babyProfileId: input.babyProfileId, type: input.type, occurredAt: parsedDate(input.occurredAt, "发生时间"), title: input.title.trim().slice(0, 300), provider: clean(input.provider, "机构"), note: clean(input.note, "备注"), transactionAllocationId: input.transactionAllocationId } });
    await writeAuditLog(tx, { action: "care.record.created", entityType: "CareRecord", entityId: created.id, actorUserId: context.userId, householdId: context.householdId, requestId: context.requestId, afterData: { type: input.type, hasLedgerAllocation: Boolean(input.transactionAllocationId) } });
    return created;
  });
  return { id: row.id, babyProfileId: row.babyProfileId, type: row.type as CareRecordType, occurredAt: row.occurredAt.toISOString(), title: row.title, provider: row.provider, note: row.note, transactionAllocationId: row.transactionAllocationId };
}
export const createRecord = createCareRecord;
export const careService = { listBabies, createBaby, listGrowth, createGrowth, listVaccines, createVaccine, listRecords, createRecord };
