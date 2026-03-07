ALTER TABLE bookmarks
    ADD COLUMN search_document text;

CREATE INDEX ix_bookmarks_search_document
    ON bookmarks USING pgroonga(search_document);

COMMENT ON COLUMN bookmarks.search_document IS 'Rich searchable text containing title, URL, summary, tags, and cleaned content for full-text search on the search page';
