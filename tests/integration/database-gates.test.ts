import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const { Pool } = pg;

describeDatabase("isolated Supabase database gates", () => {
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 1 });

  beforeAll(async () => {
    await pool.query("set default_transaction_read_only = on");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("has the complete platform schema with RLS on every household table", async () => {
    const result = await pool.query<{ tablename: string; rowsecurity: boolean }>(`
      select tablename, rowsecurity
      from pg_tables
      where schemaname = 'public'
        and tablename in (
          'households', 'household_members', 'transactions', 'transaction_allocations',
          'baby_profiles', 'care_records', 'wardrobe_items', 'products',
          'inventory_batches', 'inventory_logs', 'media_assets', 'legacy_import_maps'
        )
      order by tablename
    `);
    expect(result.rows).toHaveLength(12);
    expect(result.rows.every((row) => row.rowsecurity)).toBe(true);
  });

  it("does not grant browser roles mutation access to application tables", async () => {
    const result = await pool.query<{ grantee: string; table_name: string; privilege_type: string }>(`
      select grantee, table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee in ('anon', 'authenticated')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER')
    `);
    expect(result.rows).toEqual([]);
  });
});
