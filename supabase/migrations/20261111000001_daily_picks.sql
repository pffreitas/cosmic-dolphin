CREATE TABLE daily_picks (
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    local_date date NOT NULL,
    bookmark_ids uuid[] NOT NULL,
    reasons text[] NOT NULL,
    time_zone text NOT NULL,
    computed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, local_date),
    CHECK (cardinality(bookmark_ids) BETWEEN 1 AND 5),
    CHECK (cardinality(bookmark_ids) = cardinality(reasons))
);
-- Slot IDs deliberately do not reference bookmarks: deletion hides a slot;
-- it must never rewrite the day's original positions or reasons.
ALTER TABLE daily_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_picks_owner_select ON daily_picks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY daily_picks_owner_insert ON daily_picks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY daily_picks_owner_update ON daily_picks FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY daily_picks_owner_delete ON daily_picks FOR DELETE USING (user_id = auth.uid());
