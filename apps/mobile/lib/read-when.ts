export type SaveReadWhen = "Tonight" | "This weekend" | "No rush";
export function readWhen(option: SaveReadWhen, now = new Date()): Date | null {
  if (option === "No rush") return null;
  const result = new Date(now);
  if (option === "Tonight") {
    if (now.getHours() >= 19) result.setDate(result.getDate() + 1);
    result.setHours(20, 0, 0, 0);
  } else {
    result.setHours(9, 0, 0, 0);
    while ((result.getDay() !== 6 && result.getDay() !== 0) || result <= now) result.setDate(result.getDate() + 1);
  }
  return result;
}
export function savedReadWhenCopy(value: Date | null, now = new Date()) {
  if (!value) return "Saved. Cosmic is reading it.";
  const sameDay = value.toDateString() === now.toDateString();
  const day = sameDay && value.getHours() === 20 ? "tonight" : `on ${value.toLocaleDateString("en-US", { weekday: "long" })}`;
  const hour = value.getHours();
  return `Saved. Back on Home ${day} at ${hour % 12 || 12} ${hour >= 12 ? "pm" : "am"}.`;
}
