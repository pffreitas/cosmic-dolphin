CREATE TABLE embeddings (
    id BIGINT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    embeddings vector (3072)
);

ALTER TABLE documents
DROP COLUMN embeddings;