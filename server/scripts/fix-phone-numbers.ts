/**
 * Fix UK phone numbers in the database.
 *
 * Normalisation rules (applied in order):
 *   1. Strip all non-numeric characters (spaces, dashes, brackets, +)
 *   2. Convert international prefix: 4407xxx → 07xxx, 440xxx → 0xxx
 *   3. Add leading zero to 10-digit numbers that are missing it
 *
 * Tables touched:
 *   - companies.phone
 *   - contacts.phone
 *
 * Usage:
 *   npm run db:fix-phones          — preview changes (dry run)
 *   npm run db:fix-phones -- --apply  — apply changes
 */

import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DRY_RUN = !process.argv.includes("--apply");

// SQL expression that normalises a phone column value.
// Returns the cleaned value (or the original if no change needed).
const NORMALISE_EXPR = (col: string) => `
  CASE
    -- Strip non-numeric, leaving us with a "cleaned" base
    -- Then apply format rules on the cleaned value:

    -- International +44 / 0044 / 44 prefix → leading 0
    WHEN REGEXP_REPLACE(${col}, '[^0-9]', '', 'g') ~ '^(0044|44)[0-9]{10}$'
      THEN '0' || SUBSTRING(REGEXP_REPLACE(${col}, '[^0-9]', '', 'g'), CASE WHEN LEFT(REGEXP_REPLACE(${col}, '[^0-9]', '', 'g'), 4) = '0044' THEN 5 ELSE 3 END)

    -- 10-digit number missing leading zero
    WHEN REGEXP_REPLACE(${col}, '[^0-9]', '', 'g') ~ '^[1-9][0-9]{9}$'
      THEN '0' || REGEXP_REPLACE(${col}, '[^0-9]', '', 'g')

    -- Otherwise just strip non-numeric chars
    ELSE REGEXP_REPLACE(${col}, '[^0-9]', '', 'g')
  END
`;

// Rows where normalisation would produce a different value
const NEEDS_UPDATE_COND = (col: string) => `
  ${col} IS NOT NULL
  AND ${col} != ''
  AND ${col} != (${NORMALISE_EXPR(col)})
`;

type PreviewRow = {
  id: string;
  name: string;
  old_phone: string;
  new_phone: string;
};

async function previewTable(
  client: pg.PoolClient,
  table: string,
  col: string,
  nameCol: string,
): Promise<PreviewRow[]> {
  const { rows } = await client.query<PreviewRow>(`
    SELECT
      id,
      ${nameCol} AS name,
      ${col}                       AS old_phone,
      (${NORMALISE_EXPR(col)})     AS new_phone
    FROM ${table}
    WHERE ${NEEDS_UPDATE_COND(col)}
    ORDER BY ${nameCol}
  `);
  return rows;
}

async function applyTable(
  client: pg.PoolClient,
  table: string,
  col: string,
): Promise<number> {
  const { rowCount } = await client.query(`
    UPDATE ${table}
    SET ${col} = (${NORMALISE_EXPR(col)})
    WHERE ${NEEDS_UPDATE_COND(col)}
  `);
  return rowCount ?? 0;
}

async function verificationReport(client: pg.PoolClient): Promise<void> {
  const { rows } = await client.query(`
    SELECT
      'companies.phone' AS column_ref,
      COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '')        AS total,
      COUNT(*) FILTER (WHERE phone ~ '^0[0-9]{10}$')                  AS correct,
      COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != ''
                         AND phone !~ '^0[0-9]{10}$')                 AS irregular
    FROM companies
    UNION ALL
    SELECT
      'contacts.phone',
      COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != ''),
      COUNT(*) FILTER (WHERE phone ~ '^0[0-9]{10}$'),
      COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != ''
                         AND phone !~ '^0[0-9]{10}$')
    FROM contacts
  `);

  console.log("\n── Verification report ─────────────────────────────────");
  console.log(
    `${"Column".padEnd(22)} ${"Total".padStart(7)} ${"Correct".padStart(9)} ${"Irregular".padStart(10)}`,
  );
  console.log("─".repeat(52));
  for (const r of rows) {
    console.log(
      `${r.column_ref.padEnd(22)} ${String(r.total).padStart(7)} ${String(r.correct).padStart(9)} ${String(r.irregular).padStart(10)}`,
    );
  }
  console.log("─".repeat(52));

  // Show remaining irregular numbers for manual review
  const { rows: odd } = await client.query(`
    SELECT 'companies' AS tbl, id, name, phone
    FROM companies
    WHERE phone IS NOT NULL AND phone != '' AND phone !~ '^0[0-9]{10}$'
    UNION ALL
    SELECT 'contacts', id, name, phone
    FROM contacts
    WHERE phone IS NOT NULL AND phone != '' AND phone !~ '^0[0-9]{10}$'
    ORDER BY tbl, name
    LIMIT 30
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
    console.log(DRY_RUN ? "🔍  DRY RUN — no changes will be written\n" : "✏️   APPLY MODE — changes will be committed\n");

    // ── companies.phone ──────────────────────────────────────────────
    const companyRows = await previewTable(client, "companies", "phone", "name");
    console.log(`companies.phone — ${companyRows.length} row(s) will change`);
    if (companyRows.length > 0) {
      const show = companyRows.slice(0, 20);
      for (const r of show) {
        console.log(`  ${r.name.substring(0, 40).padEnd(40)}  "${r.old_phone}"  →  "${r.new_phone}"`);
      }
      if (companyRows.length > 20) console.log(`  … and ${companyRows.length - 20} more`);
    }

    // ── contacts.phone ───────────────────────────────────────────────
    const contactRows = await previewTable(client, "contacts", "phone", "name");
    console.log(`\ncontacts.phone — ${contactRows.length} row(s) will change`);
    if (contactRows.length > 0) {
      const show = contactRows.slice(0, 20);
      for (const r of show) {
        console.log(`  ${r.name.substring(0, 40).padEnd(40)}  "${r.old_phone}"  →  "${r.new_phone}"`);
      }
      if (contactRows.length > 20) console.log(`  … and ${contactRows.length - 20} more`);
    }

    if (DRY_RUN) {
      console.log("\nRe-run with --apply to commit these changes.");
      return;
    }

    // Apply inside a transaction
    await client.query("BEGIN");

    const companyUpdated = await applyTable(client, "companies", "phone");
    const contactUpdated = await applyTable(client, "contacts", "phone");

    await client.query("COMMIT");

    console.log(`\n✅  Done — ${companyUpdated} company phone(s), ${contactUpdated} contact phone(s) updated`);

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
