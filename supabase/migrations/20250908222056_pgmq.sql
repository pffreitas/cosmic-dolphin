-- Setup pgmq (PostgreSQL Message Queue) extension and queues
-- This migration enables the pgmq extension and creates the necessary queues
-- for the Cosmic Dolphin worker service
-- Enable the pgmq extension
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create the required queues for the worker service
SELECT
    pgmq.create('default');

SELECT
    pgmq.create('tasks');

SELECT
    pgmq.create('notifications');