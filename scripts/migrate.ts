/**
 * Apply pending migrations in numeric order. Each migration runs in a single
 * transaction; the filename is recorded in schema_migrations once it succeeds.
 * Safe to re-run — already-applied migrations are skipped.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.PGLITE_DATA_DIR ?? ".pglite";
const MIGRATIONS_DIR = "migrations";

async function main() {
  const pg = new PGlite(DATA_DIR);
  await pg.waitReady;

  await pg.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (
      await pg.query<{ filename: string }>(
        "SELECT filename FROM schema_migrations"
      )
    ).rows.map((r) => r.filename)
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`apply  ${file} ... `);
    try {
      await pg.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
      });
      console.log("ok");
    } catch (e) {
      console.log("FAIL");
      console.error(e);
      process.exit(1);
    }
  }

  await pg.close();
  console.log("migrations complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
