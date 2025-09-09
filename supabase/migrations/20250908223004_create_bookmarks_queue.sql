-- Create bookmarks queue for background processing
-- This uses the PGMQ extension that should already be installed
SELECT pgmq.create('bookmarks');

-- Optionally set queue configuration for better performance
-- SET default_with_oids = false;