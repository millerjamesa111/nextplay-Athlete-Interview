-- =============================================
-- v8: PARENT CALLS + BOOKING PRIORITY
-- Run once in Supabase → SQL Editor BEFORE deploying v8.
-- Safe to re-run (IF NOT EXISTS everywhere). Existing rows become call_type = 'athlete'.
-- =============================================

-- Submissions: call type, family link, links, parent-call parsed fields
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS call_type TEXT DEFAULT 'athlete';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS athlete_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS transcript_url TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS payment_type TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS athlete_context TEXT;   -- pasted athlete interview when the family isn't in the tool

-- Athlete rows: saved pre-call brief + booking priority
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS prep_output TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS booking_priority TEXT; -- PULL FORWARD / DOUBLE-BOOK / BOOK AS NORMAL
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS booking_output TEXT;

UPDATE submissions SET call_type = 'athlete' WHERE call_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_call_type ON submissions(call_type);
CREATE INDEX IF NOT EXISTS idx_submissions_athlete_link ON submissions(athlete_submission_id);

-- Reps: who can submit parent calls
ALTER TABLE reps ADD COLUMN IF NOT EXISTS can_parent BOOLEAN DEFAULT FALSE;
