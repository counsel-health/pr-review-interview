-- 0007_threads_summary.sql
-- Add a summary column to threads. Written by the summarizeThread queue job.

ALTER TABLE threads ADD COLUMN summary TEXT;
