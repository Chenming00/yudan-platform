import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { permissions, roles } from "../lib/db/permission-catalog";

const defaultCategories = [
  ["care", "儿童保健", "CHILD_CARE"],
  ["wardrobe", "衣柜", "WARDROBE"],
  ["consumables", "消耗品", "CONSUMABLES"],
  ["food", "餐饮", "OTHER"],
  ["transport", "交通", "OTHER"],
  ["home", "居家", "OTHER"],
  ["income", "收入", "OTHER"],
  ["other", "其他", "OTHER"],
] as const;

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: 1, allowExitOnIdle: true }),
});

async function main() {
  const permissionIds = new Map<string, string>();

  for (const [code, name] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
    permissionIds.set(code, permission.id);
  }

  for (const roleDefinition of roles) {
    const role = await prisma.role.upsert({
      where: { code: roleDefinition.code },
      update: {
        name: roleDefinition.name,
        scope: roleDefinition.scope,
        isSystem: true,
      },
      create: {
        code: roleDefinition.code,
        name: roleDefinition.name,
        scope: roleDefinition.scope,
        isSystem: true,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: roleDefinition.permissions.map((code) => ({
        roleId: role.id,
        permissionId: permissionIds.get(code)!,
      })),
      skipDuplicates: true,
    });
  }

  const households = await prisma.household.findMany({ select: { id: true } });
  for (const household of households) {
    for (const [code, name, module] of defaultCategories) {
      await prisma.category.upsert({
        where: { householdId_code: { householdId: household.id, code } },
        update: { name, module, isSystem: true, isActive: true },
        create: {
          householdId: household.id,
          code,
          name,
          module,
          isSystem: true,
        },
      });
    }

    await prisma.paymentAccount.upsert({
      where: { householdId_name: { householdId: household.id, name: "默认账户" } },
      update: { isActive: true },
      create: {
        householdId: household.id,
        name: "默认账户",
        type: "CASH",
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
