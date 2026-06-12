-- 0009_inbound_messaging.sql
-- Schema for the inbound Relay messaging feature: a contact address so we can
-- route an inbound SMS to a patient, and a provider message id on messages so
-- an inbound row can be tied back to Relay's delivery.

-- Patient contact address Relay routes inbound messages by. Added nullable,
-- backfilled for the existing patient, then indexed for the webhook lookup.
ALTER TABLE patients ADD COLUMN phone TEXT;
UPDATE patients SET phone = '+15550000001' WHERE id = 'user1';
CREATE UNIQUE INDEX patients_phone_idx ON patients(phone);

-- Tie each message to Relay's delivery id. Existing messages predate Relay and
-- don't have one, so default them to '' and make the column required.
ALTER TABLE messages ADD COLUMN provider_message_id TEXT NOT NULL DEFAULT '';

