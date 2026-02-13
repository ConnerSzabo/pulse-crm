/**
 * One-off migration script: Create trust companies from academy_trust_name values
 * and link schools to them via company_relationships.
 *
 * Usage: npx tsx scripts/setup-trusts.ts
 */
import { storage } from "../server/storage";

async function main() {
  console.log("Starting trust setup from academy_trust_name values...\n");

  const result = await storage.setupTrustsFromAcademyNames();

  console.log("Trust setup complete!");
  console.log(`  Unique trust names found: ${result.uniqueTrustNames}`);
  console.log(`  Trust companies created:  ${result.trustsCreated}`);
  console.log(`  Trust companies skipped:  ${result.trustsSkipped} (already existed)`);
  console.log(`  Schools linked to trusts: ${result.schoolsLinked}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
