-- 0004_threads_physicians.sql
-- Many physicians per thread, no duplicates, expressed in the schema.

CREATE TABLE threads_physicians (
  thread_id    TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  physician_id TEXT NOT NULL REFERENCES physicians(id),
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, physician_id)
);
CREATE INDEX threads_physicians_physician_id_idx
  ON threads_physicians(physician_id);

INSERT INTO threads_physicians (thread_id, physician_id)
SELECT t.id, u.id
FROM threads t
JOIN LATERAL jsonb_array_elements_text(t.users::jsonb) AS j(uid) ON TRUE
JOIN users u ON u.id = j.uid
WHERE u.is_physician = TRUE;

-- Verification: every thread should have at least one physician now (the
-- existing data invariant; this guards a backfill bug, not the product rule
-- itself, since the product allows transient zero-physician threads).
DO $$
DECLARE
  missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing FROM threads t
    WHERE NOT EXISTS (
      SELECT 1 FROM threads_physicians tp WHERE tp.thread_id = t.id
    );
  IF missing > 0 THEN
    RAISE EXCEPTION '0004 backfill left % threads without any physician', missing;
  END IF;
END $$;
