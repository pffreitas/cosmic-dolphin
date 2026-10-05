/**
 * Identity hues — docs/design-system/foundations.md § Identity.
 *
 * Five muted hues, one per slot, for the two places the product has to draw
 * somebody it has no picture of: a person's initials on an avatar fallback,
 * and a source's letter on a favicon chip. The slot comes from a stable hash
 * of the seed (a handle, a domain), so Maya is the same colour on every row,
 * in every session, on web and mobile alike.
 *
 * Identity only. A slot never encodes a topic, a state or a rank, and none of
 * the five sits on the accent's blue, the AI's violet or the like's pink.
 *
 * The class strings are written out whole so Tailwind can see them.
 */
const SLOTS = [
  "bg-id-1-bg text-id-1",
  "bg-id-2-bg text-id-2",
  "bg-id-3-bg text-id-3",
  "bg-id-4-bg text-id-4",
  "bg-id-5-bg text-id-5",
] as const;

/** FNV-1a over the normalised seed: cheap, stable, and well spread. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (const char of seed.trim().toLowerCase().replace(/^www\./, "")) {
    h ^= char.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** `bg-id-n-bg text-id-n` for this seed. */
export function identityClass(seed: string): string {
  return SLOTS[hash(seed) % SLOTS.length];
}
