-- Remove title and icon columns from resources table
ALTER TABLE
    resources DROP COLUMN IF EXISTS title;

ALTER TABLE
    resources DROP COLUMN IF EXISTS icon;

-- Add OpenGraph, Metadata, and UserMeta columns as JSONB
ALTER TABLE
    resources
ADD
    COLUMN opengraph JSONB DEFAULT '{}',
ADD
    COLUMN metadata JSONB DEFAULT '{}',
ADD
    COLUMN usermeta JSONB DEFAULT '{}';