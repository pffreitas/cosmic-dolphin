CREATE TABLE pipelines (
    id bigint primary key generated always as identity,
    name VARCHAR(255) NOT NULL,
    args JSONB NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    reference_id bigint NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pipeline_stages (
    id bigint primary key generated always as identity,
    pipeline_id BIGINT REFERENCES pipelines(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pipeline_stages_pipeline_id ON pipeline_stages(pipeline_id);