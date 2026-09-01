import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

type PrismaGlobal = typeof globalThis & {
  __yudanPrisma?: PrismaClient;
};

function requireDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to access PostgreSQL");
  }

  return connectionString;
}

export function createPrismaClient(connectionString = requireDatabaseUrl()) {
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

  return new PrismaClient({ adapter });
}

const prismaGlobal = globalThis as PrismaGlobal;

export const db = prismaGlobal.__yudanPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.__yudanPrisma = db;
}
