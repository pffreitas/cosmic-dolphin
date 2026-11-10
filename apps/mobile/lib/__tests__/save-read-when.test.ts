import { readWhen, savedReadWhenCopy } from "../read-when";
it("Save timing follows local 19:00 cutoff, the next future weekend morning, and explicit No rush", () => {
  const friday = new Date(2026, 10, 13, 18, 59);
  expect(readWhen("Tonight", friday)).toEqual(new Date(2026, 10, 13, 20));
  expect(readWhen("Tonight", new Date(2026, 10, 13, 19))).toEqual(new Date(2026, 10, 14, 20));
  expect(readWhen("This weekend", friday)).toEqual(new Date(2026, 10, 14, 9));
  expect(readWhen("This weekend", new Date(2026, 10, 14, 10))).toEqual(new Date(2026, 10, 15, 9));
  expect(readWhen("This weekend", new Date(2026, 10, 15, 10))).toEqual(new Date(2026, 10, 21, 9));
  expect(readWhen("No rush", friday)).toBeNull();
  expect(savedReadWhenCopy(readWhen("Tonight", friday), friday)).toBe("Saved. Back on Home tonight at 8 pm.");
});
