-- v8.1: when the parent call is booked (read from the athlete interview, editable in the app)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS parent_call_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_submissions_parent_call_at ON submissions(parent_call_at);
