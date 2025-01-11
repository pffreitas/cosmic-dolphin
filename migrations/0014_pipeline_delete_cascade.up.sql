-- 1. Drop the existing foreign key constraint
ALTER TABLE pipeline_stages
  DROP CONSTRAINT pipeline_stages_pipeline_id_fkey;

-- 2. Re-add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_pipeline_id_fkey
  FOREIGN KEY (pipeline_id)
  REFERENCES pipelines(id)
  ON DELETE CASCADE;