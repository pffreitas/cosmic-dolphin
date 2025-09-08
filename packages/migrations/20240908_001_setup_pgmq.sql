-- Setup pgmq (PostgreSQL Message Queue) extension and queues
-- This migration enables the pgmq extension and creates the necessary queues
-- for the Cosmic Dolphin worker service

-- Enable the pgmq extension
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create the required queues for the worker service
SELECT pgmq.create('default');
SELECT pgmq.create('tasks');
SELECT pgmq.create('notifications');

-- Grant necessary permissions for the service role
-- This ensures the worker can interact with the queues
GRANT USAGE ON SCHEMA pgmq_public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgmq_public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgmq_public TO service_role;

-- Grant permissions for the authenticated role (if needed for API access)
GRANT USAGE ON SCHEMA pgmq_public TO authenticated;
GRANT EXECUTE ON FUNCTION pgmq_public.send(text, jsonb, integer) TO authenticated;

-- Set up RLS policies for queue access
-- Note: pgmq tables don't use RLS by default, but we can add custom policies if needed
-- For now, we rely on the service role having full access

-- Create a function to check queue health/stats (optional)
CREATE OR REPLACE FUNCTION pgmq_public.queue_stats(queue_name text)
RETURNS TABLE (
  queue_name text,
  queue_length bigint,
  newest_msg_age_sec double precision,
  oldest_msg_age_sec double precision,
  total_messages bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    queue_name,
    queue_length,
    newest_msg_age_sec,
    oldest_msg_age_sec,
    total_messages
  FROM pgmq.metrics(queue_stats.queue_name);
$$;

-- Grant execute permission on the stats function
GRANT EXECUTE ON FUNCTION pgmq_public.queue_stats(text) TO service_role;
GRANT EXECUTE ON FUNCTION pgmq_public.queue_stats(text) TO authenticated;

-- Add a comment for documentation
COMMENT ON EXTENSION pgmq IS 'PostgreSQL Message Queue extension for Cosmic Dolphin worker service';