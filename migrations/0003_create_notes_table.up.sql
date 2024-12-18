CREATE TABLE notes (
    id BIGINT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    tags TEXT NOT NULL,
    sections JSONB NOT NULL
);
