BEGIN;

-- Step 1: Add a new column with the desired type
ALTER TABLE notes ADD COLUMN tags_new jsonb;

-- Step 2: Migrate data from the old column to the new column
UPDATE notes
SET tags_new = to_jsonb(string_to_array(tags, ','));

-- Step 3: Drop the old column
ALTER TABLE notes DROP COLUMN tags;

-- Step 4: Rename the new column to the original column name
ALTER TABLE notes RENAME COLUMN tags_new TO tags;

COMMIT;