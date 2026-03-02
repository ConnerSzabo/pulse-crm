/**
 * Fix UK phone numbers in the database.
 *
 * Normalisation rules (applied in order):
 *   1. Strip all non-numeric characters (spaces, dashes, brackets, +)
 *   2. Convert international prefix: 0044/44 + 10 digits → leading 0
 *   3. Add leading zero to 10-digit numbers that are missing it
 *
 * Tables / columns touched:
 *   - companies.phone
 *   - trusts.phone
 *   - trusts.decision_maker_phone
 *   - contacts.phone
 *
 * Usage:
 *   npm run db:fix-phones            — preview changes (dry run)
 *   npm run db:fix-phones -- --apply — apply changes
 */

import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DRY_RUN = !process.argv.includes("--apply");

// SQL expression that normalises a single phone column value.
const NORMALISE_EXPR = (col: string) => `
  CASE
    -- International +44 / 0044 prefix → leading 0
    WHEN REGEXP_REPLACE(${col}, '[^0-9]', '', 'g') ~ '^(0044|44)[0-9]{10}$'
      THEN '0' || SUBSTRING(
        REGEXP_REPLACE(${col}, '[^0-9]', '', 'g'),
        CASE WHEN LEFT(REGEXP_REPLACE(${col}, '[^0-9]', '', 'g'), 4) = '0044' THEN 5 ELSE 3 END
      )
    -- 10-digit number missing leading zero
    WHEN REGEXP_REPLACE(${col}, '[^0-9]', '', 'g') ~ '^[1-9][0-9]{9}$'
      THEN '0' || REGEXP_REPLACE(${col}, '[^0-9]', '', 'g')
    -- Otherwise just strip non-numeric chars
    ELSE REGEXP_REPLACE(${col}, '[^0-9]', '', 'g')
  END
`;

const NEEDS_UPDATE_COND = (col: string) => `
  ${col} IS NOT NULL
  AND ${col} != ''
  AND ${col} != (${NORMALISE_EXPR(col)})
`;

type PreviewRow = { id: string; name: string; old_phone: string; new_phone: string };

async function previewTable(
  client: pg.PoolClient,
  table: string,
  col: string,
  nameCol: string,
): Promise<PreviewRow[]> {
  const { rows } = await client.query<PreviewRow>(`
    SELECT id, ${nameCol} AS name, ${col} AS old_phone, (${NORMALISE_EXPR(col)}) AS new_phone
    FROM ${table}
    WHERE ${NEEDS_UPDATE_COND(col)}
    ORDER BY ${nameCol}
  `);
  return rows;
}

async function applyTable(client: pg.PoolClient, table: string, col: string): Promise<number> {
  const { rowCount } = await client.query(`
    UPDATE ${table}
    SET ${col} = (${NORMALISE_EXPR(col)})
    WHERE ${NEEDS_UPDATE_COND(col)}
  `);
  return rowCount ?? 0;
}

function printPreview(label: string, rows: PreviewRow[]) {
  console.log(`${label} — ${rows.length} row(s) will change`);
  for (const r of rows.slice(0, 20)) {
    console.log(`  ${r.name.substring(0, 40).padEnd(40)}  "${r.old_phone}"  →  "${r.new_phone}"`);
  }
  if (rows.length > 20) console.log(`  … and ${rows.length - 20} more`);
}

async function verificationReport(client: pg.PoolClient): Promise<void> {
  const { rows } = await client.query(`
    SELECT 'companies.phone'              AS col, COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '') AS total, COUNT(*) FILTER (WHERE phone ~ '^0[0-9]{10}$') AS correct, COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '' AND phone !~ '^0[0-9]{10}$') AS irregular FROM companies
    UNION ALL
    SELECT 'trusts.phone',               COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != ''), COUNT(*) FILTER (WHERE phone ~ '^0[0-9]{10}$'), COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '' AND phone !~ '^0[0-9]{10}$') FROM trusts
    UNION ALL
    SELECT 'trusts.decision_maker_phone', COUNT(*) FILTER (WHERE decision_maker_phone IS NOT NULL AND decision_maker_phone != ''), COUNT(*) FILTER (WHERE decision_maker_phone ~ '^0[0-9]{10}$'), COUNT(*) FILTER (WHERE decision_maker_phone IS NOT NULL AND decision_maker_phone != '' AND decision_maker_phone !~ '^0[0-9]{10}$') FROM trusts
    UNION ALL
    SELECT 'contacts.phone',             COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != ''), COUNT(*) FILTER (WHERE phone ~ '^0[0-9]{10}$'), COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '' AND phone !~ '^0[0-9]{10}$') FROM contacts
  `);

  console.log("\n── Verification report ──────────────────────────────────────");
  console.log(`${"Column".padEnd(30)} ${"Total".padStart(7)} ${"Correct".padStart(9)} ${"Irregular".padStart(10)}`);
  console.log("─".repeat(60));
  for (const r of rows) {
    console.log(`${r.col.padEnd(30)} ${String(r.total).padStart(7)} ${String(r.correct).padStart(9)} ${String(r.irregular).padStart(10)}`);
  }
  console.log("─".repeat(60));

  const { rows: odd } = await client.query(`
    SELECT 'companies' AS tbl, name, phone AS phone FROM companies WHERE phone IS NOT NULL AND phone != '' AND phone !~ '^0[0-9]{10}$'
    UNION ALL
    SELECT 'trusts', name, phone FROM trusts WHERE phone IS NOT NULL AND phone != '' AND phone !~ '^0[0-9]{10}$'
    UNION ALL
    SELECT 'trusts.dm', name, decision_maker_phone FROM trusts WHERE decision_maker_phone IS NOT NULL AND decision_maker_phone != '' AND decision_maker_phone !~ '^0[0-9]{10}$'
    UNION ALL
    SELECT 'contacts', name, phone FROM contacts WHERE phone IS NOT NULL AND phone != '' AND phone !~ '^0[0-9]{10}$'
    ORDER BY tbl, name LIMIT 30
  `);

  if (odd.length > 0) {
    console.log("\nIrregular numbers still present (manual review needed):");
    for (const r of odd) {
      console.log(`  [${r.tbl}] ${r.name} → "${r.phone}"`);
    }
    if (odd.length === 30) console.log("  … (capped at 30 rows)");
  }
}

async function main() {
  const client = await pool.connect();
  try {
    console.log(DRY_RUN
      ? "🔍  DRY RUN — no changes will be written\n"
      : "✏️   APPLY MODE — changes will be committed\n");

    const companyRows  = await previewTable(client, "companies", "phone",                "name");
    const trustRows    = await previewTable(client, "trusts",    "phone",                "name");
    const trustDmRows  = await previewTable(client, "trusts",    "decision_maker_phone", "name");
    const contactRows  = await previewTable(client, "contacts",  "phone",                "name");

    printPreview("companies.phone",               companyRows);
    console.log();
    printPreview("trusts.phone",                  trustRows);
    console.log();
    printPreview("trusts.decision_maker_phone",   trustDmRows);
    console.log();
    printPreview("contacts.phone",                contactRows);

    if (DRY_RUN) {
      console.log("\nRe-run with --apply to commit these changes.");
      return;
    }

    await client.query("BEGIN");
    const n1 = await applyTable(client, "companies", "phone");
    const n2 = await applyTable(client, "trusts",    "phone");
    const n3 = await applyTable(client, "trusts",    "decision_maker_phone");
    const n4 = await applyTable(client, "contacts",  "phone");
    await client.query("COMMIT");

    console.log(`\n✅  Done — ${n1} company, ${n2} trust phone, ${n3} trust DM phone, ${n4} contact phone(s) updated`);
    await verificationReport(client);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
