-- Durable bookmark processing timeline and usage accounting

CREATE TABLE bookmark_processing_runs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    started_at timestamptz NOT NULL,
    ended_at timestamptz,
    duration_ms integer,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    total_tokens integer DEFAULT 0 NOT NULL,
    reasoning_tokens integer DEFAULT 0 NOT NULL,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(18, 10),
    error text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE bookmark_processing_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id uuid NOT NULL REFERENCES bookmark_processing_runs(id) ON DELETE CASCADE,
    parent_event_id uuid REFERENCES bookmark_processing_events(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('run', 'phase', 'turn')),
    phase text,
    name text NOT NULL,
    status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    sequence integer NOT NULL,
    started_at timestamptz NOT NULL,
    ended_at timestamptz,
    duration_ms integer,
    model_id text,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    total_tokens integer DEFAULT 0 NOT NULL,
    reasoning_tokens integer DEFAULT 0 NOT NULL,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(18, 10),
    provider_metadata jsonb,
    metadata jsonb,
    error text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (run_id, sequence)
);

CREATE INDEX idx_bookmark_processing_runs_bookmark_user
    ON bookmark_processing_runs(bookmark_id, user_id, started_at DESC);

CREATE INDEX idx_bookmark_processing_events_run_sequence
    ON bookmark_processing_events(run_id, sequence ASC);

CREATE INDEX idx_bookmark_processing_events_parent
    ON bookmark_processing_events(parent_event_id);

CREATE TRIGGER update_bookmark_processing_runs_updated_at
    BEFORE UPDATE ON bookmark_processing_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookmark_processing_events_updated_at
    BEFORE UPDATE ON bookmark_processing_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

