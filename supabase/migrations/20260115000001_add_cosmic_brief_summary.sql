-- Add cosmic_brief_summary column to bookmarks table
-- This column stores a compelling preview summary (2-4 sentences) to help users
-- decide if they want to read the full summarized content

ALTER TABLE bookmarks 
ADD COLUMN cosmic_brief_summary TEXT;
