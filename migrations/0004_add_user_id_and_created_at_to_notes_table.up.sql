ALTER TABLE notes
ADD COLUMN user_id VARCHAR(255),
ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();