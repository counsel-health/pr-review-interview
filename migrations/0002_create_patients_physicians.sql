-- 0002_create_patients_physicians.sql
-- Split the single `users` table into `patients` and `physicians`. Ids are
-- preserved so existing FKs in `messages.userId` and `threads.users` stay
-- resolvable while 0003-0005 finish the migration.

CREATE TABLE patients (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE physicians (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO patients (id, name)
SELECT id, name FROM users WHERE is_physician = FALSE;

INSERT INTO physicians (id, name)
SELECT id, name FROM users WHERE is_physician = TRUE;

-- Verification: every row from `users` should have landed in exactly one of
-- the two tables.
DO $$
DECLARE
  src_count INTEGER;
  dst_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO src_count FROM users;
  SELECT (SELECT COUNT(*) FROM patients) + (SELECT COUNT(*) FROM physicians) INTO dst_count;
  IF src_count <> dst_count THEN
    RAISE EXCEPTION '0002 backfill mismatch: users=%, patients+physicians=%', src_count, dst_count;
  END IF;
END $$;
