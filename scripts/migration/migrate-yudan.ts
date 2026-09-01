import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import pg, { type PoolClient } from "pg";

import { mapLegacyCategory } from "./category-map";
import { buildLedgerReport, buildMigrationChecks, type PantryReport } from "./report";

const { Pool } = pg;
const sourceProject = "YUDAN";
const applyChanges = process.argv.includes("--apply");

function argumentValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

type LegacyTransaction = {
  id: string;
  amount: string;
  category: string | null;
  note: string | null;
  type: "expense" | "income";
  created_at: Date;
  transaction_time: Date | null;
};

type LegacyDashboard = { user_id: string; birthday: string };

type LegacyGrowthRecord = {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: string;
  height_cm: string | null;
  head_circumference_cm: string | null;
  note: string;
  legacy_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type LegacyVaccineCatalog = {
  id: string;
  sort_order: number;
  age_months: number;
  age_label: string;
  vaccine: string;
  dose: string;
  funding: string;
  date_rule: string | null;
  date_offset_days: number;
  source: string;
  active: boolean;
  updated_at: Date;
  region: string;
  schedule_version: string;
  prevents: string;
  aliases: string[];
  audience: string | null;
  schedule_note: string | null;
};

type LegacyVaccineRecord = {
  id: string;
  user_id: string;
  plan_id: string;
  administered_on: string;
  place: string;
  batch_no: string;
  manufacturer: string;
  note: string;
  legacy_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function requireEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sourceHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readSourceData(sourceUrl: string) {
  const source = new Pool({ connectionString: sourceUrl, max: 1 });
  const client = await source.connect();

  try {
    await client.query("begin read only");
    await client.query("set local statement_timeout = '30s'");
    const [transactions, dashboards, growth, vaccineCatalog, vaccineRecords] =
      await Promise.all([
        client.query<LegacyTransaction>(
          "select id, amount, category, note, type, created_at, transaction_time from public.transactions order by coalesce(transaction_time, created_at), id",
        ),
        client.query<LegacyDashboard>(
          "select user_id, birthday from public.yudan_dashboards order by user_id",
        ),
        client.query<LegacyGrowthRecord>(
          "select id, user_id, measured_on, weight_kg, height_cm, head_circumference_cm, note, legacy_id, created_at, updated_at from public.yudan_weight_records order by measured_on, id",
        ),
        client.query<LegacyVaccineCatalog>(
          "select id, sort_order, age_months, age_label, vaccine, dose, funding, date_rule, date_offset_days, source, active, updated_at, region, schedule_version, prevents, aliases, audience, schedule_note from public.yudan_vaccine_catalog order by sort_order",
        ),
        client.query<LegacyVaccineRecord>(
          "select id, user_id, plan_id, administered_on, place, batch_no, manufacturer, note, legacy_id, created_at, updated_at from public.yudan_vaccine_records order by administered_on, id",
        ),
      ]);

    const result = {
      transactions: transactions.rows,
      dashboards: dashboards.rows,
      growth: growth.rows,
      vaccineCatalog: vaccineCatalog.rows,
      vaccineRecords: vaccineRecords.rows,
    };
    await client.query("rollback");
    return result;
  } finally {
    client.release();
    await source.end();
  }
}

async function readPantryData(sourceUrl: string): Promise<PantryReport> {
  const pool = new Pool({ connectionString: sourceUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("begin read only");
    await client.query("set local statement_timeout = '30s'");
    const counts = await client.query<{
      product_count: number; stock_entry_count: number; inventory_log_count: number;
      product_group_count: number; product_group_item_count: number; available_quantity: number;
      platform_schema_ready: boolean;
    }>(`select
      (select count(*)::int from public.products) product_count,
      (select count(*)::int from public.inventory_batches) stock_entry_count,
      (select count(*)::int from public.inventory_logs) inventory_log_count,
      (select count(*)::int from public.product_groups) product_group_count,
      (select count(*)::int from public.product_group_items) product_group_item_count,
      (select coalesce(sum(available_quantity), 0)::int from public.inventory_batches) available_quantity,
      to_regclass('public.legacy_import_maps') is not null platform_schema_ready`);
    const stock = await client.query<{ product_code: string; available_quantity: number }>(`select
      p.product_code, coalesce(sum(b.available_quantity), 0)::int available_quantity
      from public.products p left join public.inventory_batches b on b.product_code = p.product_code
      group by p.product_code order by p.product_code`);
    await client.query("rollback");
    const row = counts.rows[0];
    return {
      productCount: row.product_count,
      stockEntryCount: row.stock_entry_count,
      inventoryLogCount: row.inventory_log_count,
      productGroupCount: row.product_group_count,
      productGroupItemCount: row.product_group_item_count,
      availableQuantity: row.available_quantity,
      platformSchemaReady: row.platform_schema_ready,
      stockByProduct: stock.rows.map((item) => ({ productCode: item.product_code, availableQuantity: item.available_quantity })),
    };
  } finally {
    client.release();
    await pool.end();
  }
}

function buildSourceReport(data: Awaited<ReturnType<typeof readSourceData>>, pantry: PantryReport) {
  const babyProfiles = data.dashboards.length;
  const distinctBirthdays = new Set(data.dashboards.map((row) => row.birthday)).size;
  const ledger = buildLedgerReport(data.transactions.map((row) => ({
    amount: row.amount,
    category: row.category,
    type: row.type,
    occurredAt: row.transaction_time ?? row.created_at,
  })), process.env.APP_TIME_ZONE || "Asia/Shanghai");
  const validation = buildMigrationChecks({ ledgerCount: ledger.count, babyProfiles, distinctBirthdays, pantry });
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: applyChanges ? "apply" : "dry-run",
    sources: {
      yudan: {
        ledger,
        babyProfiles,
        distinctBirthdays,
        growthRecords: data.growth.length,
        vaccineCatalog: data.vaccineCatalog.length,
        vaccineRecords: data.vaccineRecords.length,
      },
      pantry,
    },
    ...validation,
  };
}

async function outputReport(report: unknown) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  console.log(serialized.trimEnd());
  const reportPath = argumentValue("report");
  if (!reportPath) return;
  const absolutePath = resolve(reportPath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, serialized, "utf8");
  console.log(`Migration report written to ${absolutePath}`);
}

async function assertTarget(
  target: PoolClient,
  householdId: string,
  actorUserId: string,
) {
  const schema = await target.query<{ ready: boolean }>(
    "select to_regclass('public.legacy_import_maps') is not null as ready",
  );
  if (!schema.rows[0]?.ready) {
    throw new Error("Platform migration has not been applied to the target database");
  }

  const context = await target.query<{ household: boolean; actor: boolean }>(
    `select
      exists(select 1 from public.households where id = $1) as household,
      exists(select 1 from public.app_users where id = $2 and status = 'ACTIVE') as actor`,
    [householdId, actorUserId],
  );
  if (!context.rows[0]?.household || !context.rows[0]?.actor) {
    throw new Error("TARGET_HOUSEHOLD_ID or TARGET_ACTOR_USER_ID is not ready");
  }
}

async function importLedger(
  target: PoolClient,
  rows: LegacyTransaction[],
  householdId: string,
  actorUserId: string,
) {
  for (const row of rows) {
    const alreadyImported = await target.query(
      "select 1 from public.legacy_import_maps where source_project = $1 and source_table = 'transactions' and source_id = $2",
      [sourceProject, row.id],
    );
    if (alreadyImported.rowCount) continue;

    const mapped = mapLegacyCategory(row.category);
    const category = await target.query<{ id: string }>(
      `insert into public.categories
        (household_id, code, name, module, is_system, is_active, sort_order, created_at, updated_at)
       values ($1, $2, $3, $4, false, true, 0, now(), now())
       on conflict (household_id, code) do update set name = excluded.name, module = excluded.module, updated_at = now()
       returning id`,
      [householdId, mapped.categoryCode, mapped.category, mapped.module],
    );

    const transactionType = row.type === "income" ? "INCOME" : "EXPENSE";
    const inserted = await target.query(
      `insert into public.transactions
        (id, household_id, type, amount, currency, transaction_at, note, created_by_user_id, created_at, updated_at)
       values ($1, $2, $3, $4, 'CNY', $5, $6, $7, $8, now())
       on conflict (id) do nothing`,
      [
        row.id,
        householdId,
        transactionType,
        row.amount,
        row.transaction_time ?? row.created_at,
        row.note,
        actorUserId,
        row.created_at,
      ],
    );
    if (inserted.rowCount !== 1) {
      throw new Error(`Target transaction id already exists without an import map: ${row.id}`);
    }

    await target.query(
      `insert into public.transaction_allocations
        (household_id, transaction_id, category_id, module, amount, created_at, updated_at)
       values ($1, $2, $3, $4, $5, now(), now())`,
      [householdId, row.id, category.rows[0].id, mapped.module, row.amount],
    );

    await target.query(
      `insert into public.legacy_import_maps
        (source_project, source_table, source_id, target_table, target_id, source_hash)
       values ($1, 'transactions', $2, 'transactions', $2, $3)`,
      [sourceProject, row.id, sourceHash(row)],
    );
  }
}

async function importBabyProfile(
  target: PoolClient,
  dashboards: LegacyDashboard[],
  householdId: string,
  babyName: string,
) {
  if (!dashboards.length) return new Map<string, string>();

  const birthdays = new Set(dashboards.map((row) => row.birthday));
  if (birthdays.size !== 1) {
    throw new Error("Legacy users do not share one birthday; explicit baby mapping is required");
  }

  const priorMap = await target.query<{ target_id: string }>(
    "select target_id from public.legacy_import_maps where source_project = $1 and source_table = 'yudan_dashboards' limit 1",
    [sourceProject],
  );
  let babyProfileId = priorMap.rows[0]?.target_id;

  if (!babyProfileId) {
    const profile = await target.query<{ id: string }>(
      `insert into public.baby_profiles
        (household_id, name, birthday, created_at, updated_at)
       values ($1, $2, $3, now(), now()) returning id`,
      [householdId, babyName, dashboards[0].birthday],
    );
    babyProfileId = profile.rows[0].id;
  }

  const userMap = new Map<string, string>();
  for (const row of dashboards) {
    userMap.set(row.user_id, babyProfileId);
    await target.query(
      `insert into public.legacy_import_maps
        (source_project, source_table, source_id, target_table, target_id, source_hash)
       values ($1, 'yudan_dashboards', $2, 'baby_profiles', $3, $4)
       on conflict (source_project, source_table, source_id) do nothing`,
      [sourceProject, row.user_id, babyProfileId, sourceHash(row)],
    );
  }
  return userMap;
}

async function importHealth(
  target: PoolClient,
  data: Awaited<ReturnType<typeof readSourceData>>,
  householdId: string,
  babyName: string,
) {
  const userMap = await importBabyProfile(
    target,
    data.dashboards,
    householdId,
    babyName,
  );

  for (const row of data.vaccineCatalog) {
    await target.query(
      `insert into public.vaccine_catalog
        (id, sort_order, age_months, age_label, vaccine, dose, funding, date_rule,
         date_offset_days, source, active, updated_at, region, schedule_version,
         prevents, aliases, audience, schedule_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       on conflict (id) do update set
         sort_order = excluded.sort_order, age_months = excluded.age_months,
         age_label = excluded.age_label, vaccine = excluded.vaccine, dose = excluded.dose,
         funding = excluded.funding, date_rule = excluded.date_rule,
         date_offset_days = excluded.date_offset_days, source = excluded.source,
         active = excluded.active, updated_at = excluded.updated_at,
         region = excluded.region, schedule_version = excluded.schedule_version,
         prevents = excluded.prevents, aliases = excluded.aliases,
         audience = excluded.audience, schedule_note = excluded.schedule_note`,
      [
        row.id, row.sort_order, row.age_months, row.age_label, row.vaccine, row.dose,
        row.funding, row.date_rule, row.date_offset_days, row.source, row.active,
        row.updated_at, row.region, row.schedule_version, row.prevents, row.aliases,
        row.audience, row.schedule_note,
      ],
    );
  }

  for (const row of data.growth) {
    const babyProfileId = userMap.get(row.user_id);
    if (!babyProfileId) throw new Error(`No baby mapping for legacy user ${row.user_id}`);
    const exists = await target.query(
      "select 1 from public.legacy_import_maps where source_project = $1 and source_table = 'yudan_weight_records' and source_id = $2",
      [sourceProject, row.id],
    );
    if (exists.rowCount) continue;

    await target.query(
      `insert into public.growth_records
        (id, household_id, baby_profile_id, measured_on, weight_kg, height_cm,
         head_circumference_cm, note, legacy_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        row.id, householdId, babyProfileId, row.measured_on, row.weight_kg,
        row.height_cm, row.head_circumference_cm, row.note,
        row.legacy_id ?? row.id, row.created_at, row.updated_at,
      ],
    );
    await target.query(
      `insert into public.legacy_import_maps
        (source_project, source_table, source_id, target_table, target_id, source_hash)
       values ($1, 'yudan_weight_records', $2, 'growth_records', $2, $3)`,
      [sourceProject, row.id, sourceHash(row)],
    );
  }

  for (const row of data.vaccineRecords) {
    const babyProfileId = userMap.get(row.user_id);
    if (!babyProfileId) throw new Error(`No baby mapping for legacy user ${row.user_id}`);
    const exists = await target.query(
      "select 1 from public.legacy_import_maps where source_project = $1 and source_table = 'yudan_vaccine_records' and source_id = $2",
      [sourceProject, row.id],
    );
    if (exists.rowCount) continue;

    await target.query(
      `insert into public.vaccine_records
        (id, household_id, baby_profile_id, vaccine_id, administered_on, place,
         batch_no, manufacturer, note, legacy_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        row.id, householdId, babyProfileId, row.plan_id, row.administered_on,
        row.place, row.batch_no, row.manufacturer, row.note,
        row.legacy_id ?? row.id, row.created_at, row.updated_at,
      ],
    );
    await target.query(
      `insert into public.legacy_import_maps
        (source_project, source_table, source_id, target_table, target_id, source_hash)
       values ($1, 'yudan_vaccine_records', $2, 'vaccine_records', $2, $3)`,
      [sourceProject, row.id, sourceHash(row)],
    );
  }
}

async function targetReport(target: PoolClient, vaccineCatalogIds: string[]) {
  const result = await target.query(
    `select source_table, count(*)::int imported_rows
     from public.legacy_import_maps
     where source_project = $1
     group by source_table order by source_table`,
    [sourceProject],
  );
  const ledger = await target.query<{
    row_count: number; income: string; expense: string;
  }>(
    `select count(*)::int row_count,
       coalesce(sum(t.amount) filter (where t.type = 'INCOME'), 0)::numeric(14,2)::text income,
       coalesce(sum(t.amount) filter (where t.type = 'EXPENSE'), 0)::numeric(14,2)::text expense
     from public.transactions t
     join public.legacy_import_maps m
       on m.target_table = 'transactions' and m.target_id = t.id::text
     where m.source_project = $1 and m.source_table = 'transactions'`,
    [sourceProject],
  );
  const catalog = await target.query<{ row_count: number }>(
    "select count(*)::int row_count from public.vaccine_catalog where id = any($1::text[])",
    [vaccineCatalogIds],
  );
  return { imports: result.rows, ledger: ledger.rows[0], vaccineCatalog: catalog.rows[0].row_count };
}

async function assertExistingMappingsUnchanged(
  target: PoolClient,
  data: Awaited<ReturnType<typeof readSourceData>>,
) {
  const mappedRows = [
    ...data.transactions.map((row) => ({ table: "transactions", id: row.id, hash: sourceHash(row) })),
    ...data.dashboards.map((row) => ({ table: "yudan_dashboards", id: row.user_id, hash: sourceHash(row) })),
    ...data.growth.map((row) => ({ table: "yudan_weight_records", id: row.id, hash: sourceHash(row) })),
    ...data.vaccineRecords.map((row) => ({ table: "yudan_vaccine_records", id: row.id, hash: sourceHash(row) })),
  ];
  const existing = await target.query<{ source_table: string; source_id: string; source_hash: string | null }>(
    `select source_table, source_id, source_hash
     from public.legacy_import_maps where source_project = $1`,
    [sourceProject],
  );
  const currentHashes = new Map(mappedRows.map((row) => [`${row.table}:${row.id}`, row.hash]));
  for (const row of existing.rows) {
    const current = currentHashes.get(`${row.source_table}:${row.source_id}`);
    if (!current || current !== row.source_hash) {
      throw new Error(`Legacy source changed after import: ${row.source_table}/${row.source_id}`);
    }
  }
}

function assertReconciled(
  sourceReport: ReturnType<typeof buildSourceReport>,
  imported: Awaited<ReturnType<typeof targetReport>>,
) {
  const importCounts = new Map(imported.imports.map((row) => [String(row.source_table), Number(row.imported_rows)]));
  const expected = sourceReport.sources.yudan;
  const mismatches = [
    ["transactions", imported.ledger.row_count, expected.ledger.count],
    ["transaction income", imported.ledger.income, expected.ledger.income],
    ["transaction expense", imported.ledger.expense, expected.ledger.expense],
    ["dashboard maps", importCounts.get("yudan_dashboards") ?? 0, expected.babyProfiles],
    ["growth maps", importCounts.get("yudan_weight_records") ?? 0, expected.growthRecords],
    ["vaccine record maps", importCounts.get("yudan_vaccine_records") ?? 0, expected.vaccineRecords],
    ["vaccine catalog", imported.vaccineCatalog, expected.vaccineCatalog],
  ].filter(([, actual, wanted]) => String(actual) !== String(wanted));
  if (mismatches.length) {
    throw new Error(`Post-import reconciliation failed: ${JSON.stringify(mismatches)}`);
  }
}

async function main() {
  const sourceUrl = requireEnvironment("LEGACY_YUDAN_DATABASE_URL");
  const pantryUrl = requireEnvironment("LEGACY_PANTRY_DATABASE_URL");
  const [data, pantry] = await Promise.all([readSourceData(sourceUrl), readPantryData(pantryUrl)]);
  const sourceReport = buildSourceReport(data, pantry);
  await outputReport(sourceReport);

  if (!applyChanges) {
    console.log("Dry-run complete. Re-run with --apply after reviewing the report.");
    return;
  }

  if (!sourceReport.safeToApply) {
    throw new Error("Dry-run checks are not all PASS; refusing to write to the target database");
  }
  if (process.env.MIGRATION_BACKUP_CONFIRMED !== "YES") {
    throw new Error("MIGRATION_BACKUP_CONFIRMED=YES is required after verifying backup/PITR");
  }
  if (process.env.MIGRATION_TARGET_CONFIRM !== "yudan-wupin") {
    throw new Error("MIGRATION_TARGET_CONFIRM=yudan-wupin is required");
  }

  const targetUrl = requireEnvironment("DIRECT_URL");
  const householdId = requireEnvironment("TARGET_HOUSEHOLD_ID");
  const actorUserId = requireEnvironment("TARGET_ACTOR_USER_ID");
  const babyName = process.env.TARGET_BABY_NAME?.trim() || "鱼蛋";
  const pool = new Pool({ connectionString: targetUrl, max: 1 });
  const target = await pool.connect();

  try {
    await target.query("begin");
    await target.query("set local lock_timeout = '5s'");
    await target.query("select pg_advisory_xact_lock(hashtext('yudan-legacy-import'))");
    await assertTarget(target, householdId, actorUserId);
    await assertExistingMappingsUnchanged(target, data);
    await importLedger(target, data.transactions, householdId, actorUserId);
    await importHealth(target, data, householdId, babyName);
    const imported = await targetReport(target, data.vaccineCatalog.map((row) => row.id));
    assertReconciled(sourceReport, imported);
    await target.query("commit");
    await outputReport({ ...sourceReport, target: imported, committed: true });
  } catch (error) {
    await target.query("rollback");
    throw error;
  } finally {
    target.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
