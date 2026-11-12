import { readWhen, restoreLater } from "../read-when";

it("Tonight uses device-local 20:00 today before 19:00 and tomorrow at or after 19:00", () => {
  for (const [hour, minute, expectedDay] of [[18, 59, 11], [19, 0, 12], [23, 59, 12]]) {
    const value = readWhen("Tonight", new Date(2026, 10, 11, hour, minute))!;
    expect([value.getDate(), value.getHours(), value.getMinutes()]).toEqual([expectedDay, 20, 0]);
  }
});
it("This weekend is the next future Saturday or Sunday 09:00, including exact 09:00 and 10:00", () => {
  for (const [day, hour, minute, expectedDay] of [[14, 8, 59, 14], [14, 9, 0, 15], [14, 10, 0, 15], [15, 8, 59, 15], [15, 9, 0, 21], [15, 10, 0, 21]]) {
    const value = readWhen("This weekend", new Date(2026, 10, day, hour, minute))!;
    expect([value.getDate(), value.getHours(), value.getMinutes()]).toEqual([expectedDay, 9, 0]);
  }
});
it("Next week is next Monday 07:00 and a Monday always chooses the following Monday", () => {
  for (const [day, expectedDay] of [[15, 16], [16, 23], [17, 23]]) {
    const value = readWhen("Next week", new Date(2026, 10, day, 6))!;
    expect([value.getDate(), value.getDay(), value.getHours()]).toEqual([expectedDay, 1, 7]);
  }
});
it("Tomorrow is 07:00 on the next local calendar day, across device timezone and DST boundaries", () => {
  for (const now of [new Date(2026, 2, 7, 10), new Date(2026, 9, 31, 10), new Date(2026, 2, 28, 10), new Date(2026, 9, 24, 10), new Date(2026, 3, 4, 10), new Date(2026, 9, 3, 10)]) {
    const value = readWhen("Tomorrow", now)!;
    const expected = new Date(now); expected.setDate(expected.getDate() + 1); expected.setHours(7, 0, 0, 0);
    expect(value.toISOString()).toBe(expected.toISOString());
    expect(value.getHours()).toBe(7);
    const tonight = readWhen("Tonight", now)!;
    expect(tonight.getHours()).toBe(20);
    expect(readWhen("This weekend", now)!.getTime()).toBeGreaterThan(now.getTime());
    expect(readWhen("Next week", now)!.getTime()).toBeGreaterThan(now.getTime());
  }
});
it("Later Undo keeps a prior future instant and clears a prior elapsed or exact-now instant", () => {
  const now = new Date(2026, 10, 11, 10);
  const future = new Date(now.getTime() + 60000);
  expect(restoreLater(future, now)).toEqual(future);
  expect(restoreLater(new Date(now.getTime() - 1), now)).toBeNull();
  expect(restoreLater(now, now)).toBeNull();
  expect(restoreLater(undefined, now)).toBeNull();
});
