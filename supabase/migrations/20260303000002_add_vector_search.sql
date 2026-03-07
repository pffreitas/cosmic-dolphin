CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE text_chunks
    ADD COLUMN embedding vector(1536);

CREATE INDEX ix_text_chunks_embedding
    ON text_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
