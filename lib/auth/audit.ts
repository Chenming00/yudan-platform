import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type AuditClient = Pick<PrismaClient, "auditLog"> | Prisma.TransactionClient;

export async function writeAuditLog(
  client: AuditClient,
  input: {
    action: string;
    entityType: string;
    entityId?: string;
    actorUserId?: string;
    householdId?: string;
    requestId?: string;
    beforeData?: Prisma.InputJsonValue;
    afterData?: Prisma.InputJsonValue;
  },
) {
  await client.auditLog.create({ data: input });
}
