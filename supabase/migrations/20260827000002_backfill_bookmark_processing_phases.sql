-- Rename the pipeline's phase vocabulary in place, so old timelines stay
-- readable.
--
-- The pipeline used to emit nine internal names. The UI speaks the six from
-- docs/functional-spec/03-ai-pipeline.md — fetch, extract, summarise, tag,
-- file, embed — and labels a phase by looking its name up. Left alone, every
-- run recorded before this deploy would render as unlabelled rows: the history
-- would still be there and would no longer say anything.
--
-- So: map, do not drop. Each remapped event keeps its original phase under
-- `metadata.legacyPhase`, which is what an internal cost view needs in order to
-- compare a run from before the rename with one from after.
--
-- The mapping is the same table as `LEGACY_BOOKMARK_PROCESSING_PHASES` in
-- packages/shared/src/services/bookmark-processing-reporter.service.ts. Change
-- one and you must change the other.
--
--   summarization, brief_summary  -> summarise   (two calls, one line)
--   tags                          -> tag
--   images, private_link_enrichment -> extract
--   categorization                -> file
--   chunking, embedding           -> embed       (surfaced to nobody)
--   finalization                  -> NULL        (bookkeeping, never a phase)
--
-- `finalization` becomes NULL rather than being folded into a neighbour. It
-- wrote the search document and flipped the status; calling it "Filing into a
-- collection" would be a lie told to make a checklist tidier. The event keeps
-- its name and its token accounting, and simply has no line in the UI.

UPDATE bookmark_processing_events
SET
    metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object('legacyPhase', phase),
    phase = CASE phase
        WHEN 'summarization' THEN 'summarise'
        WHEN 'brief_summary' THEN 'summarise'
        WHEN 'tags' THEN 'tag'
        WHEN 'images' THEN 'extract'
        WHEN 'private_link_enrichment' THEN 'extract'
        WHEN 'categorization' THEN 'file'
        WHEN 'chunking' THEN 'embed'
        WHEN 'embedding' THEN 'embed'
        WHEN 'finalization' THEN NULL
    END
WHERE phase IN (
    'summarization',
    'brief_summary',
    'tags',
    'images',
    'private_link_enrichment',
    'categorization',
    'chunking',
    'embedding',
    'finalization'
);

-- A guard rail rather than a rename: `phase` was free text, and free text is
-- how the vocabulary drifted in the first place. Existing rows are already
-- conformant after the UPDATE above, and NULL stays legal for spans that are
-- not phases (the run event, and finalization's history).
ALTER TABLE bookmark_processing_events
    ADD CONSTRAINT bookmark_processing_events_phase_check
    CHECK (
        phase IS NULL
        OR phase IN ('fetch', 'extract', 'summarise', 'tag', 'file', 'embed')
    );
