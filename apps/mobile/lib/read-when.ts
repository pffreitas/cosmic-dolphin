export type SaveReadWhen = "Tonight" | "This weekend" | "No rush";
export type LaterOption = "Tonight" | "Tomorrow" | "This weekend" | "Next week";
export function readWhen(option: SaveReadWhen | LaterOption, now = new Date()): Date | null {
  if (option === "No rush") return null;
  const result = new Date(now);
  if (option === "Tonight") {
    if (now.getHours() >= 19) result.setDate(result.getDate() + 1);
    result.setHours(20, 0, 0, 0);
  } else if (option === "Tomorrow") {
    result.setDate(result.getDate() + 1);
    result.setHours(7, 0, 0, 0);
  } else if (option === "Next week") {
    result.setDate(result.getDate() + ((8 - result.getDay()) % 7 || 7));
    result.setHours(7, 0, 0, 0);
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
/** Owner PATCH rejects elapsed timestamps, including an instant elapsed during Undo. */
export function restoreLater(prior: Date | null | undefined, now = new Date()): Date | null {
  return prior && prior.getTime() > now.getTime() ? prior : null;
}
function localTime(value: Date) {
  const hour = value.getHours(); const minute = value.getMinutes();
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour >= 12 ? "pm" : "am"}`;
}
export function laterTimeDetail(value: Date) {
  return `${value.toLocaleDateString("en-US", { weekday: "short" })}, ${localTime(value)}`;
}
export function backTimeCopy(value: Date, now = new Date()) {
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = value.toDateString() === now.toDateString() && value.getHours() === 20 ? "tonight"
    : value.toDateString() === tomorrow.toDateString() ? "tomorrow" : `on ${value.toLocaleDateString("en-US", { weekday: "long" })}`;
  return `${day} at ${localTime(value)}`;
}
