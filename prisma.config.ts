import "dotenv/config";

import { defineConfig } from "prisma/config";

const localValidationUrl =
  "postgresql://localhost:54322/yudan_validation";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations must use DIRECT_URL. The fallback only lets offline schema
    // validation and client generation run without production credentials.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? localValidationUrl,
  },
});
