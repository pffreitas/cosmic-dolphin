/**
 * At most one reading-progress write per bookmark per 5 seconds, plus one on
 * unmount — docs/functional-spec/04-library.md § Reading progress.
 *
 * Duplicated here rather than imported: `packages/shared` is backend-only by
 * the repo's dependency rules, and clients talk to the API through the
 * generated contract. The server keeps the same number in
 * `PROGRESS_WRITE_INTERVAL_MS` (`packages/shared/src/services/reading.service.ts`)
 * and the API contract states it in prose, so the three agree by intent rather
 * than by import. If this changes, change all three.
 */
export const PROGRESS_WRITE_INTERVAL_MS = 5_000;
