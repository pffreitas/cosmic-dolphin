import AsyncStorage from "@react-native-async-storage/async-storage";
import { createRequest, saveQueue } from "../save-queue";
jest.mock("expo-crypto", () => ({ randomUUID: () => require("crypto").randomUUID() }));
beforeEach(async () => { await AsyncStorage.clear(); jest.restoreAllMocks(); });
it("serialized interrupted writes retain earlier entries and a later enqueue/removal cannot resurrect or lose entries", async () => {
  const first = await saveQueue.enqueue({ sourceUrl: "https://example.com/one", captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
  const original = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("Interrupted write"));
  await expect(saveQueue.enqueue({ sourceUrl: "https://example.com/lost", captureSource: "clipboard", capturePlatform: "ios" }, "reader")).rejects.toThrow();
  (AsyncStorage.setItem as jest.Mock).mockImplementation(original);
  const [second] = await Promise.all([
    saveQueue.enqueue({ sourceUrl: "https://example.com/two", captureSource: "clipboard", capturePlatform: "ios" }, "reader"),
    saveQueue.remove(first.id),
  ]);
  expect((await saveQueue.list()).map(entry => entry.id)).toEqual([second.id]);
});
it("drains only matching accounts and durably binds an unowned capture before authenticated replay", async () => {
  await saveQueue.enqueue({ sourceUrl: "https://example.com/other", captureSource: "save_sheet", capturePlatform: "ios" }, "other");
  await saveQueue.enqueue({ sourceUrl: "https://example.com/mine", captureSource: "clipboard", capturePlatform: "ios" }, "reader");
  const unowned = await saveQueue.enqueue({ sourceUrl: "https://example.com/unowned", captureSource: "save_sheet", capturePlatform: "ios" });
  const create = jest.fn(async (request) => {
    if (request.sourceUrl.endsWith("unowned")) expect((await saveQueue.list()).find(entry => entry.id === unowned.id)?.userId).toBe("reader");
    return { bookmark: { id: request.sourceUrl, userId: "reader" }, alreadySaved: true };
  });
  await saveQueue.drain("reader", { create } as any);
  expect(create.mock.calls.map(([body]) => body.sourceUrl)).toEqual(["https://example.com/mine", "https://example.com/unowned"]);
  expect((await saveQueue.list()).map(entry => entry.url)).toEqual(["https://example.com/other"]);
});
it("400 keeps a durable failed row until Remove and does not replay a rejected link automatically", async () => {
  const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/rejected", captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
  const create = jest.fn(async () => { throw { response: new Response(null, { status: 400 }) }; });
  await saveQueue.drain("reader", { create } as any);
  expect(await saveQueue.list()).toEqual([expect.objectContaining({ id: entry.id, failure: "rejected", attempts: 1 })]);
  await saveQueue.drain("reader", { create } as any);
  expect(create).toHaveBeenCalledTimes(1);
  await saveQueue.remove(entry.id);
  expect(await saveQueue.list()).toEqual([]);
});
it("401 keeps the original account's capture until matching sign-in without leaking it to another user", async () => {
  const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/auth", captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
  const create = jest.fn().mockRejectedValueOnce({ response: new Response(null, { status: 401 }) }).mockResolvedValue({ bookmark: { id: "accepted", userId: "reader" } });
  await saveQueue.drain("reader", { create } as any);
  expect(await saveQueue.list()).toEqual([expect.objectContaining({ id: entry.id, failure: "auth", userId: "reader" })]);
  await saveQueue.drain("other", { create } as any);
  expect(create).toHaveBeenCalledTimes(1);
  await saveQueue.drain("reader", { create } as any);
  expect(await saveQueue.list()).toEqual([]);
});
it("429 persists Retry-After and skips replay before notBefore for seconds and HTTP dates", async () => {
  for (const retryAfter of ["120", new Date(Date.now() + 180000).toUTCString()]) {
    const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/rate", captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
    const create = jest.fn().mockRejectedValueOnce({ response: new Response(null, { status: 429, headers: { "Retry-After": retryAfter } }) }).mockResolvedValue({ bookmark: { id: "accepted", userId: "reader" } });
    await saveQueue.drain("reader", { create } as any);
    const saved = (await saveQueue.list())[0];
    expect(Date.parse(saved.notBefore!)).toBeGreaterThan(Date.now() + 100000);
    await saveQueue.drain("reader", { create } as any);
    expect(create).toHaveBeenCalledTimes(1);
    await saveQueue.patch(entry.id, { notBefore: new Date(Date.now() - 1).toISOString() });
    await saveQueue.drain("reader", { create } as any);
    expect(await saveQueue.list()).toEqual([]);
  }
});
it("network and 5xx retain Retry/Remove entries and a later replay accepts alreadySaved", async () => {
  for (const error of [new Error("Offline"), { response: new Response(null, { status: 503 }) }]) {
    const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/retry", captureSource: "clipboard", capturePlatform: "ios" }, "reader");
    const create = jest.fn().mockRejectedValueOnce(error).mockResolvedValue({ bookmark: { id: "accepted", userId: "reader" }, alreadySaved: true });
    await saveQueue.drain("reader", { create } as any);
    expect(await saveQueue.list()).toEqual([expect.objectContaining({ id: entry.id, failure: "retry", attempts: 1 })]);
    await saveQueue.drain("reader", { create } as any);
    expect(await saveQueue.list()).toEqual([]);
  }
});
it("elapsed queued Later clears to null while private fields, note, source and original queuedAt survive replay", async () => {
  const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/private", isPrivateLink: true, title: "Private", description: "Describe, do not fetch", userNote: "Remember", laterUntil: new Date(Date.now() - 1), captureSource: "clipboard", capturePlatform: "ios" }, "reader");
  const create = jest.fn(async (_request: unknown) => ({ bookmark: { id: "accepted", userId: "reader" } }));
  await saveQueue.drain("reader", { create } as any);
  expect(create.mock.calls[0][0]).toEqual(expect.objectContaining({ isPrivateLink: true, title: "Private", description: "Describe, do not fetch", userNote: "Remember", laterUntil: null, captureSource: "clipboard", capturePlatform: "ios", queuedAt: new Date(entry.queuedAt) }));
});
it("an 8-second unacknowledged create stays durable and an aborted process can drain again", async () => {
  jest.useFakeTimers();
  try {
    const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/timeout", captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
    const create = jest.fn(() => new Promise<any>(() => {}));
    const first = saveQueue.drain("reader", { create });
    await jest.advanceTimersByTimeAsync(8000);
    await first;
    expect(await saveQueue.list()).toEqual([expect.objectContaining({ id: entry.id, failure: "retry" })]);
    const process = new AbortController();
    const interrupted = saveQueue.drain("reader", { create }, { signal: process.signal });
    await jest.advanceTimersByTimeAsync(0);
    process.abort();
    await interrupted;
    expect(await saveQueue.list()).toHaveLength(1);
    await saveQueue.drain("reader", { create: async () => ({ bookmark: { id: "accepted", userId: "reader" } as any }) });
    expect(await saveQueue.list()).toEqual([]);
  } finally { jest.useRealTimers(); }
});
it("a stale confirmation from a different account cannot change the original owner's durable create", async () => {
  const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/owned", captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
  await expect((saveQueue.confirm as any)(entry.id, { note: "Another account", laterUntil: null }, "other")).rejects.toThrow("account");
  expect((await saveQueue.list())[0].note).toBeUndefined();
});
it("Android retries retain stable ID, original time, attempts and attribution across rate limit and matching-user replay", async () => {
  const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/android-replay", captureSource: "android_share", capturePlatform: "android" }, "reader");
  const create = jest.fn().mockRejectedValueOnce({ response: new Response(null, { status: 429, headers: { "Retry-After": "120" } }) }).mockResolvedValue({ bookmark: { id: "accepted", userId: "reader" }, alreadySaved: true });
  await saveQueue.drain("reader", { create } as any);
  expect(await saveQueue.list()).toEqual([expect.objectContaining({ id: entry.id, queuedAt: entry.queuedAt, attempts: 1, captureSource: "android_share", capturePlatform: "android" })]);
  await saveQueue.drain("other", { create } as any);
  await saveQueue.drain("reader", { create } as any);
  expect(create).toHaveBeenCalledTimes(1);
  await saveQueue.patch(entry.id, { notBefore: new Date(Date.now() - 1).toISOString() });
  await saveQueue.drain("reader", { create } as any);
  expect(create.mock.calls[1][0]).toMatchObject({ sourceUrl: entry.url, queuedAt: new Date(entry.queuedAt), captureSource: "android_share", capturePlatform: "android" });
  expect(await saveQueue.list()).toEqual([]);
});
