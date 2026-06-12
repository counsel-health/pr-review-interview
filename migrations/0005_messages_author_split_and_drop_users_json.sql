-- 0005_messages_author_split_and_drop_users_json.sql
-- Split message authorship into author_patient_id / author_physician_id with
-- a CHECK enforcing exactly one. Drop messages.userId, drop threads.users
-- JSON column, drop the now-unused users table.

ALTER TABLE messages
  ADD COLUMN author_patient_id   TEXT REFERENCES patients(id),
  ADD COLUMN author_physician_id TEXT REFERENCES physicians(id);

UPDATE messages m
SET author_patient_id = u.id
FROM users u
WHERE u.id = m."userId" AND u.is_physician = FALSE;

UPDATE messages m
SET author_physician_id = u.id
FROM users u
WHERE u.id = m."userId" AND u.is_physician = TRUE;

-- Verification: every message should now have exactly one of the two authors set.
DO $$
DECLARE
  bad INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad FROM messages
    WHERE (author_patient_id IS NULL) = (author_physician_id IS NULL);
  IF bad > 0 THEN
    RAISE EXCEPTION '0005 left % messages with bad author state', bad;
  END IF;
END $$;

ALTER TABLE messages
  ADD CONSTRAINT messages_author_xor
  CHECK ((author_patient_id IS NOT NULL) <> (author_physician_id IS NOT NULL));

ALTER TABLE messages DROP COLUMN "userId";
ALTER TABLE threads  DROP COLUMN users;
DROP TABLE users;

-- Normalize the remaining quoted-camelCase columns to snake_case so the
-- post-migration schema reads consistently.
ALTER TABLE messages RENAME COLUMN "threadId"  TO thread_id;
ALTER TABLE messages RENAME COLUMN "msgIndex"  TO msg_index;
ALTER TABLE messages RENAME CONSTRAINT "messages_threadId_fkey" TO messages_thread_id_fkey;
ALTER TABLE messages RENAME CONSTRAINT "messages_threadId_msgIndex_key" TO messages_thread_id_msg_index_key;
