import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors/app-error";

const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export function parseMoney(value: string, field = "amount") {
  if (!moneyPattern.test(value)) {
    throw new AppError("VALIDATION_FAILED", `${field} 必须是最多两位小数的正数金额。`);
  }
  const amount = new Prisma.Decimal(value);
  if (amount.lessThanOrEqualTo(0)) {
    throw new AppError("VALIDATION_FAILED", `${field} 必须大于 0。`);
  }
  return amount;
}

export function formatMoney(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toFixed(2);
}

export function sumMoney(values: Iterable<Prisma.Decimal>) {
  let total = new Prisma.Decimal(0);
  for (const value of values) total = total.add(value);
  return total;
}
