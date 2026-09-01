import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { platformDefaults } from "@/lib/config/env";

interface BootstrapSuperAdminInput {
  authUserId: string;
  email: string;
  displayName?: string;
  householdId?: string;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSuperAdminRegistrationIntent(
  prisma: PrismaClient,
  email: string,
) {
  const emailNormalized = email.trim().toLowerCase();

  if (emailNormalized !== platformDefaults.superAdminEmail) {
    throw new Error("Only SUPER_ADMIN_EMAIL can use the bootstrap registration flow");
  }

  const intentToken = randomBytes(32).toString("base64url");
  const invitationToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1_000);

  await prisma.$transaction(async (tx) => {
    const [household, ownerRole] = await Promise.all([
      tx.household.findFirstOrThrow({ orderBy: { createdAt: "asc" } }),
      tx.role.findUniqueOrThrow({ where: { code: "OWNER" } }),
    ]);

    const invitation = await tx.invitation.create({
      data: {
        householdId: household.id,
        roleId: ownerRole.id,
        tokenHash: hashToken(invitationToken),
        emailNormalized,
        expiresAt,
      },
    });

    await tx.registrationIntent.create({
      data: {
        invitationId: invitation.id,
        intentTokenHash: hashToken(intentToken),
        emailNormalized,
        expiresAt,
      },
    });
  });

  return { intentToken, expiresAt };
}

export async function bootstrapSuperAdmin(
  prisma: PrismaClient,
  input: BootstrapSuperAdminInput,
) {
  const emailNormalized = input.email.trim().toLowerCase();

  if (emailNormalized !== platformDefaults.superAdminEmail) {
    throw new Error("Only SUPER_ADMIN_EMAIL can be bootstrapped as super administrator");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.appUser.upsert({
      where: { id: input.authUserId },
      update: {
        emailNormalized,
        displayName: input.displayName,
        status: "ACTIVE",
      },
      create: {
        id: input.authUserId,
        emailNormalized,
        displayName: input.displayName,
        status: "ACTIVE",
      },
    });

    const globalRole = await tx.role.findUniqueOrThrow({
      where: { code: "SUPER_ADMIN" },
    });

    await tx.userGlobalRole.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId: globalRole.id },
      },
      update: {},
      create: { userId: user.id, roleId: globalRole.id },
    });

    const household = input.householdId
      ? await tx.household.findUniqueOrThrow({ where: { id: input.householdId } })
      : await tx.household.findFirst({ orderBy: { createdAt: "asc" } });

    if (household) {
      const ownerRole = await tx.role.findUniqueOrThrow({
        where: { code: "OWNER" },
      });

      await tx.householdMember.upsert({
        where: {
          householdId_userId: {
            householdId: household.id,
            userId: user.id,
          },
        },
        update: { roleId: ownerRole.id, status: "ACTIVE" },
        create: {
          householdId: household.id,
          userId: user.id,
          roleId: ownerRole.id,
          status: "ACTIVE",
        },
      });
    }

    return { userId: user.id, householdId: household?.id ?? null };
  });
}
