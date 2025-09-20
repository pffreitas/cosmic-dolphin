-- Setup pgmq (PostgreSQL Message Queue) extension and queues
-- This migration enables the pgmq extension and creates the necessary queues
-- for the Cosmic Dolphin worker service

-- Try to enable the pgmq extension (skip if not available for testing)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pgmq;
    RAISE NOTICE 'pgmq extension enabled successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgmq extension not available (skipped for testing): %', SQLERRM;
END $$;

-- Create the required queues for the worker service (only if pgmq is available)
DO $$
BEGIN
    -- Check if pgmq extension is available before creating queues
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq') THEN
        PERFORM pgmq.create('default');
        PERFORM pgmq.create('tasks');
        PERFORM pgmq.create('notifications');
        RAISE NOTICE 'pgmq queues created successfully';
    ELSE
        RAISE NOTICE 'pgmq not available, skipping queue creation for testing';
    END IF;
END $$;