export type SystemKey = "blue" | "amber" | "mono";
export type ScreenKey = "home" | "library" | "detail";

export const contentTitleStyle = {
  fontFamily: 'Georgia, "Times New Roman", Times, serif',
};

export const systems: Array<{
  key: SystemKey;
  label: string;
  name: string;
  summary: string;
}> = [
  {
    key: "blue",
    label: "A",
    name: "Blue-Cyan Editorial Intelligence",
    summary:
      "Trusted AI organization, crisp feed hierarchy, link-native active states.",
  },
  {
    key: "amber",
    label: "B",
    name: "Amber Editorial Warmth",
    summary:
      "A calmer reading digest with library shelves and warm AI highlights.",
  },
  {
    key: "mono",
    label: "C",
    name: "Near-Monochrome Precision",
    summary:
      "Vercel/Linear-like restraint, dense inspection, color only when meaningful.",
  },
];

export const screens: Array<{ key: ScreenKey; label: string }> = [
  { key: "home", label: "Home feed" },
  { key: "library", label: "Library" },
  { key: "detail", label: "Bookmark detail" },
];

export const feedItems = [
  {
    id: "systems",
    title: "Systems beat motivation when the loop is visible",
    domain: "jamesclear.com",
    author: "Maya saved this",
    kind: "Insight",
    summary:
      "Your network is converging around small repeatable systems: weekly reviews, habit cues, and low-friction defaults.",
    why: "Ranked high from three recent saves, two trusted profiles, and one older related bookmark.",
    tags: ["habits", "teams", "practice"],
    likes: 42,
    comments: 9,
    image:
      "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "interface",
    title: "The interface is part of the memory system",
    domain: "linear.app",
    author: "Jonas commented",
    kind: "Shared link",
    summary:
      "A saved product essay becomes more useful when the UI preserves context: who shared it, what changed, and why it matters now.",
    why: "Boosted by source quality and overlap with your design-system folder.",
    tags: ["product", "interface"],
    likes: 31,
    comments: 5,
    image:
      "https://images.unsplash.com/photo-1558655146-364adaf25c85?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "reading",
    title: "A quote worth returning to before planning work",
    domain: "craft.do",
    author: "From your library",
    kind: "Quote",
    summary:
      "Clarity is not a feeling; it is a structure that survives the next interruption.",
    why: "Resurfaced because it connects to yesterday's notes on attention and folders.",
    tags: ["writing", "focus"],
    likes: 18,
    comments: 3,
    image:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=80",
  },
];

export const libraryItems = [
  {
    title: "Continuous Discovery Habits",
    domain: "producttalk.org",
    folder: "Product / Discovery",
    status: "Summarized",
    tags: ["research", "interviews"],
    age: "Saved today",
    score: "94",
  },
  {
    title: "Designing Calm Interfaces",
    domain: "maggieappleton.com",
    folder: "Design / Interface",
    status: "Categorized",
    tags: ["design", "systems"],
    age: "Saved yesterday",
    score: "89",
  },
  {
    title: "Why You Should Make Useless Things",
    domain: "austinkleon.com",
    folder: "Creativity / Essays",
    status: "Highlights ready",
    tags: ["creativity", "practice"],
    age: "Saved 4 days ago",
    score: "78",
  },
  {
    title: "The Long Game of Knowledge Work",
    domain: "stratechery.com",
    folder: "Work / Strategy",
    status: "Needs review",
    tags: ["strategy", "systems"],
    age: "Saved last week",
    score: "72",
  },
];

export const folders = [
  { name: "Product", count: 42, active: true },
  { name: "Design", count: 31 },
  { name: "AI research", count: 26 },
  { name: "Writing", count: 18 },
  { name: "Team rituals", count: 12 },
];
