import type { TodayPicksResponse } from "../types";
import { PicksRepositoryImpl } from "../repositories/picks.repository";
import { FeedRankingServiceImpl } from "./feed-ranking.service";
import { mapDatabaseRowToBookmark } from "./bookmark.service";

export class InvalidPickTimeZone extends Error {}
export class PicksServiceImpl {
  constructor(private repository: PicksRepositoryImpl, private ranker: Pick<FeedRankingServiceImpl, "rankOwn">) {}

  async today(userId: string, timeZone: string): Promise<TodayPicksResponse> {
    const started = performance.now();
    const clock = await this.repository.clock(timeZone);
    if (!clock) throw new InvalidPickTimeZone("Unknown time zone");
    let stored = await this.repository.find(userId, clock.localDate);
    if (!stored && clock.canCompute) {
      const candidates = await this.repository.candidates(userId, clock.now);
      const ranked = await this.ranker.rankOwn(userId, candidates, clock.now);
      const counts = new Map<string, number>();
      const picked = ranked.filter(item => {
        const count = counts.get(item.domain) ?? 0;
        if (count >= 2) return false;
        counts.set(item.domain, count + 1);
        return true;
      }).slice(0, 5);
      if (picked.length) {
        const inserted = await this.repository.insert({ user_id: userId, local_date: clock.localDate,
          bookmark_ids: picked.map(item => item.bookmarkId), reasons: picked.map(item => item.reason),
          time_zone: timeZone, computed_at: clock.now });
        stored = await this.repository.find(userId, clock.localDate);
        if (inserted) console.info({ user_id: userId, local_date: clock.localDate, time_zone: timeZone,
          eligible_count: candidates.length, picked_count: picked.length, picks_ms: performance.now() - started }, "Picks computed");
      }
    }
    const rows = stored ? await this.repository.bookmarks(userId, stored.bookmark_ids) : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    const items = stored ? stored.bookmark_ids.flatMap((id, index) => {
      const row = byId.get(id);
      return row && (!row.later_until || row.later_until <= clock.now)
        ? [{ position: index + 1, bookmark: mapDatabaseRowToBookmark(row), reason: stored!.reasons[index] }] : [];
    }) : [];
    const revealsAt = rows.map(row => row.later_until)
      .filter((time): time is Date => !!time && time > clock.now && time < clock.refreshesAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    console.info({ user_id: userId, local_date: clock.localDate, visible_count: items.length,
      done_count: items.filter(item => item.bookmark.readAt).length }, "Picks served");
    return { localDate: clock.localDate, refreshesAt: clock.refreshesAt, ...(stored ? { computedAt: stored.computed_at } : {}), ...(revealsAt ? { revealsAt } : {}), items };
  }
}
