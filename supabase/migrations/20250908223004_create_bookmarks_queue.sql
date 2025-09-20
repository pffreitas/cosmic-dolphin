-- Create bookmarks queue for background processing
-- This uses the PGMQ extension that should already be installed

-- Create bookmarks queue only if pgmq is available
DO $$
BEGIN
    -- Check if pgmq extension is available before creating queue
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq') THEN
        PERFORM pgmq.create('bookmarks');
        RAISE NOTICE 'bookmarks queue created successfully';
    ELSE
        RAISE NOTICE 'pgmq not available, skipping bookmarks queue creation for testing';
    END IF;
END $$;

-- Optionally set queue configuration for better performance
-- SET default_with_oids = false;