import type { Edition } from "./home-editions";
// In-memory navigation handoff. Never reuse a private edition for another account.
let owner: string | undefined;
let editions = new Map<string, Edition>();
export function rememberEditions(userId: string, values: Edition[]) {
  owner = userId;
  editions = new Map(values.map((value) => [value.id, value]));
}
export function recalledEdition(userId: string, id: string) {
  return owner === userId ? editions.get(id) : undefined;
}
