/**
 * One-time export of the existing SQLite database into a Postgres-dialect
 * seed SQL file. The output is checked in as migrations/0001_init.sql so a
 * fresh Postgres database can be seeded with the ported SQLite data.
 */
import { Database } from "sqlite3";
import { open } from "sqlite";
import { writeFileSync } from "fs";
import { join } from "path";

const pgEscape = (s: string) => "'" + s.replace(/'/g, "''") + "'";

async function main() {
  const db = await open({
    filename: "src/db/counsel_db.sqlite",
    driver: Database,
  });

  const users = await db.all<any[]>("SELECT id, name, is_physician FROM users");
  const threads = await db.all<any[]>(
    "SELECT id, title, users, date_created FROM threads ORDER BY date_created"
  );
  // SQLite didn't enforce FKs, so the source data contains ~2.6k messages
  // pointing at threadIds that don't exist. Drop them on export so Postgres
  // can hold the data with real FK enforcement.
  const messages = await db.all<any[]>(
    `SELECT m.id, m.userId, m.threadId, m.message, m.timestamp, m.msgIndex
     FROM messages m
     JOIN threads t ON t.id = m.threadId
     ORDER BY m.id`
  );

  const lines: string[] = [];
  lines.push("-- 0001_init.sql");
  lines.push(
    "-- Ports the current SQLite schema and data into Postgres verbatim."
  );
  lines.push(
    "-- After this migration, the Postgres database is shape-and-data equivalent"
  );
  lines.push(
    "-- to src/db/counsel_db.sqlite. Subsequent migrations (0002-0005) reshape it."
  );
  lines.push("");
  lines.push("CREATE TABLE users (");
  lines.push("  id           TEXT PRIMARY KEY,");
  lines.push("  name         TEXT NOT NULL,");
  lines.push("  is_physician BOOLEAN NOT NULL");
  lines.push(");");
  lines.push("");
  lines.push("CREATE TABLE threads (");
  lines.push("  id           TEXT PRIMARY KEY,");
  lines.push("  title        TEXT NOT NULL,");
  lines.push("  users        TEXT NOT NULL,");
  lines.push("  date_created BIGINT NOT NULL");
  lines.push(");");
  lines.push("");
  lines.push("CREATE TABLE messages (");
  lines.push("  id        BIGSERIAL PRIMARY KEY,");
  lines.push('  "userId"    TEXT NOT NULL REFERENCES users(id),');
  lines.push('  "threadId"  TEXT NOT NULL REFERENCES threads(id),');
  lines.push("  message   TEXT NOT NULL,");
  lines.push("  timestamp BIGINT NOT NULL,");
  lines.push('  "msgIndex"  INTEGER NOT NULL,');
  lines.push('  UNIQUE ("threadId", "msgIndex")');
  lines.push(");");
  lines.push("-- Legacy schema: no indexes on messages.threadId / messages.userId.");
  lines.push("");

  for (const u of users) {
    lines.push(
      `INSERT INTO users (id, name, is_physician) VALUES (${pgEscape(u.id)}, ${pgEscape(u.name)}, ${u.is_physician ? "TRUE" : "FALSE"});`
    );
  }
  lines.push("");

  for (const t of threads) {
    lines.push(
      `INSERT INTO threads (id, title, users, date_created) VALUES (${pgEscape(t.id)}, ${pgEscape(t.title)}, ${pgEscape(t.users)}, ${t.date_created});`
    );
  }
  lines.push("");

  for (const m of messages) {
    lines.push(
      `INSERT INTO messages (id, "userId", "threadId", message, timestamp, "msgIndex") VALUES (${m.id}, ${pgEscape(m.userId)}, ${pgEscape(m.threadId)}, ${pgEscape(m.message)}, ${m.timestamp}, ${m.msgIndex});`
    );
  }
  lines.push("");
  lines.push(
    "-- Resync the BIGSERIAL sequence to the max id so subsequent inserts pick up after the seed."
  );
  lines.push(
    "SELECT setval(pg_get_serial_sequence('messages','id'), COALESCE((SELECT MAX(id) FROM messages), 1));"
  );

  const out = join("migrations", "0001_init.sql");
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(
    `wrote ${out}: ${users.length} users, ${threads.length} threads, ${messages.length} messages`
  );
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
