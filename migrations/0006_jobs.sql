-- 0006_jobs.sql
-- Backing table for the SQS-shaped in-process job queue
-- (src/server/queue/queue.ts). Modeled on the columns needed to honor SQS
-- semantics locally: at-least-once delivery, visibility timeouts, dedup,
-- and attempt accounting.

CREATE TABLE jobs (
  id                BIGSERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued',  -- 'queued' | 'in_flight' | 'done' | 'failed'
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 5,
  deduplication_id  TEXT,
  message_group_id  TEXT,
  receipt_handle    TEXT,
  visible_after     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error        TEXT
);

CREATE INDEX jobs_visible_after_idx
  ON jobs(visible_after)
  WHERE status = 'queued';

CREATE UNIQUE INDEX jobs_dedup_idx
  ON jobs(deduplication_id)
  WHERE deduplication_id IS NOT NULL;
