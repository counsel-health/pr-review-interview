-- 0003_threads_patient_fk.sql
-- Add threads.patient_id as a real FK column to patients(id). Backfill by
-- parsing the JSON `users` array on each thread and picking the single
-- non-physician id. Then enforce NOT NULL and add the supporting index.
-- The JSON `users` column is left in place until 0004 has populated the
-- physicians join table; 0005 drops it.

ALTER TABLE threads ADD COLUMN patient_id TEXT REFERENCES patients(id);

UPDATE threads t
SET patient_id = (
  SELECT u.id
  FROM jsonb_array_elements_text(t.users::jsonb) AS j(uid)
  JOIN users u ON u.id = j.uid
  WHERE u.is_physician = FALSE
  LIMIT 1
);

-- Verification: every thread should now have exactly one patient.
DO $$
DECLARE
  missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing FROM threads WHERE patient_id IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION '0003 backfill left % threads without a patient', missing;
  END IF;
END $$;

ALTER TABLE threads ALTER COLUMN patient_id SET NOT NULL;
CREATE INDEX threads_patient_id_idx ON threads(patient_id);
