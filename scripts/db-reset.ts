/**
 * Reset the local PGlite database by deleting the data directory. The next
 * call into the app (or `yarn migrate`) will recreate it and re-apply all
 * migrations from scratch.
 */
import { rmSync, existsSync } from "fs";

const DATA_DIR = process.env.PGLITE_DATA_DIR ?? ".pglite";

if (existsSync(DATA_DIR)) {
  rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`removed ${DATA_DIR}`);
} else {
  console.log(`${DATA_DIR} did not exist; nothing to reset`);
}
