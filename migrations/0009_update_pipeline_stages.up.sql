
ALTER TABLE pipeline_stages
ADD COLUMN status VARCHAR(255) NOT NULL,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;