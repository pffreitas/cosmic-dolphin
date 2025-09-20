-- Drop indexes first (to avoid dependency issues)
DROP INDEX IF EXISTS idx_bookmark_tags_bookmark_id;

DROP INDEX IF EXISTS idx_bookmark_tags_tag;

DROP INDEX IF EXISTS idx_pipeline_stages_pipeline_id;

DROP INDEX IF EXISTS river_job_args_index;

DROP INDEX IF EXISTS river_job_kind;

DROP INDEX IF EXISTS river_job_metadata_index;

DROP INDEX IF EXISTS river_job_prioritized_fetching_index;

DROP INDEX IF EXISTS river_job_state_and_finalized_at_index;

DROP INDEX IF EXISTS river_job_unique_idx;

-- Drop tables
DROP TABLE IF EXISTS bookmark_tags CASCADE;

DROP TABLE IF EXISTS tag_usage CASCADE;

DROP TABLE IF EXISTS documents CASCADE;

DROP TABLE IF EXISTS embeddings CASCADE;

DROP TABLE IF EXISTS notes CASCADE;

DROP TABLE IF EXISTS pipeline_stages CASCADE;

DROP TABLE IF EXISTS pipelines CASCADE;

DROP TABLE IF EXISTS resources CASCADE;

DROP TABLE IF EXISTS river_client CASCADE;

DROP TABLE IF EXISTS river_client_queue CASCADE;

DROP TABLE IF EXISTS river_job CASCADE;

DROP TABLE IF EXISTS river_leader CASCADE;

DROP TABLE IF EXISTS river_migration CASCADE;

DROP TABLE IF EXISTS river_queue CASCADE;

DROP TABLE IF EXISTS schema_migrations CASCADE;