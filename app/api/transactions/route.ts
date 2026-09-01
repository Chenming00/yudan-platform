import { NextResponse } from "next/server";
import { z } from "zod";

import { apiSuccess } from "@/lib/api/response";
import { getLedgerApiContext, ledgerApiError, requestIdFrom, validationFailure } from "@/lib/api/ledger";
import { createTransaction, getLedgerOptions, listTransactions } from "@/modules/ledger";

const legacyTransactionSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(String),
  category: z.string().trim().max(200).nullable().optional(),
  note: z.string().max(1_000).nullable().optional(),
  type: z.enum(["expense", "income", "EXPENSE", "INCOME"]),
  transaction_time: z.iso.datetime({ offset: true }).optional(),
});

function legacyShape(transaction: Awaited<ReturnType<typeof createTransaction>>) {
  return {
    id: transaction.id,
    amount: transaction.amount,
    category: transaction.allocations[0]?.category?.name ?? "未分类",
    note: transaction.note,
    type: transaction.type.toLowerCase(),
    created_at: transaction.occurredAt,
    transaction_time: transaction.occurredAt,
  };
}
/** Compatibility endpoint for the original Yudan-log transaction shape. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const context = await getLedgerApiContext(requestId);
    const page = await listTransactions(context, { limit: 100 });
    return NextResponse.json(apiSuccess({ transactions: page.items.map(legacyShape), nextCursor: page.nextCursor }, requestId));
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = legacyTransactionSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error, requestId);
    const context = await getLedgerApiContext(requestId);
    const options = await getLedgerOptions(context);
    const category = options.categories.find((item) => item.name === parsed.data.category)
      ?? options.categories.find((item) => item.module === "OTHER");
    const transaction = await createTransaction(context, {
      type: parsed.data.type.toUpperCase() as "EXPENSE" | "INCOME",
      amount: parsed.data.amount,
      occurredAt: parsed.data.transaction_time ?? new Date().toISOString(),
      paymentAccountId: options.paymentAccounts[0]?.id,
      note: parsed.data.note ?? undefined,
      allocations: [{ module: category?.module ?? "OTHER", categoryId: category?.id, amount: parsed.data.amount }],
    });
    return NextResponse.json(apiSuccess(legacyShape(transaction), requestId), { status: 201 });
  } catch (error) {
    return ledgerApiError(error, requestId);
  }
}
