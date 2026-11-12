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

it("a lost create ACK replays the latest fields and reconciles newer confirmation on duplicate without another bookmark or job", async () => {
  const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/uncertain-create", captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
  const owner = new AbortController();
  const requests: any[] = [];
  let server: any;
  let jobs = 0;
  let sent!: () => void;
  const started = new Promise<void>(resolve => { sent = resolve; });
  const create = jest.fn(async (request: any) => {
    requests.push(request);
    if (!server) {
      server = { id: "one-bookmark", userId: "reader", userNote: request.userNote ?? null, laterUntil: request.laterUntil ?? null };
      jobs++;
      sent();
      return new Promise<any>(() => {}); // server accepted; process never got ACK
    }
    if (server.userNote === null && request.userNote !== undefined) server.userNote = request.userNote;
    if (request.laterUntil !== undefined) server.laterUntil = request.laterUntil;
    return { bookmark: { ...server }, alreadySaved: true };
  });
  const update = jest.fn(async (_id: string, fields: any) => { Object.assign(server, fields); return { ...server }; });
  const first = saveQueue.drain("reader", { create, update }, { signal: owner.signal });
  await started;
  await saveQueue.confirm(entry.id, { note: "New durable intent", laterUntil: null }, "reader");
  owner.abort();
  await first;
  await saveQueue.drain("reader", { create, update });
  expect(requests[0]).toMatchObject({ userNote: undefined, laterUntil: undefined });
  expect(requests[1]).toMatchObject({ userNote: "New durable intent", laterUntil: null, sourceUrl: requests[0].sourceUrl, queuedAt: requests[0].queuedAt });
  expect(server).toMatchObject({ userNote: "New durable intent", laterUntil: null });
  expect(update).toHaveBeenCalledTimes(1);
  expect(jobs).toBe(1);
  expect(await saveQueue.list()).toEqual([]);
});

it.each([
  ["offline", new Error("Offline"), "retry"],
  ["503", { response: new Response(null, { status: 503 }) }, "retry"],
  ["401", { response: new Response(null, { status: 401 }) }, "auth"],
  ["wrong response owner", null, "auth"],
  ["429", { response: new Response(null, { status: 429, headers: { "Retry-After": "120" } }) }, undefined],
  ["400", { response: new Response(null, { status: 400 }) }, "rejected"],
])("keeps accepted-create confirmation intent after PATCH %s, with owner-fenced Retry/Remove", async (_name, error, failure) => {
  const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/reconcile", captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
  const bookmark = { id: "accepted", userId: "reader", userNote: null, laterUntil: null } as any;
  const create = jest.fn(async () => {
    await saveQueue.confirm(entry.id, { note: "Retain me", laterUntil: null }, "reader");
    return { bookmark };
  });
  const update = jest.fn().mockImplementationOnce(async () => {
    if (error) throw error;
    return { ...bookmark, userId: "other" };
  }).mockResolvedValue({ ...bookmark, userNote: "Retain me" });
  const saved = jest.fn();
  await saveQueue.drain("reader", { create, update }, { onAccepting: saved });
  const retained = await saveQueue.list();
  expect(retained).toEqual([expect.objectContaining({ id: entry.id, note: "Retain me", laterUntil: null })]);
  expect(retained[0].failure).toBe(failure);
  expect(saved).not.toHaveBeenCalled();
  await saveQueue.drain("other", { create, update });
  expect(update).toHaveBeenCalledTimes(1);
  if (_name === "400") {
    await saveQueue.drain("reader", { create, update });
    expect(update).toHaveBeenCalledTimes(1);
    await saveQueue.remove(entry.id);
  } else {
    if (_name === "429") {
      await saveQueue.drain("reader", { create, update });
      expect(update).toHaveBeenCalledTimes(1);
      await saveQueue.patch(entry.id, { notBefore: new Date(Date.now() - 1).toISOString() });
    }
    await saveQueue.drain("reader", { create, update });
    expect(update).toHaveBeenLastCalledWith("accepted", { userNote: "Retain me", laterUntil: null }, expect.anything(), "reader");
  }
  expect(create).toHaveBeenCalledTimes(1);
  expect(await saveQueue.list()).toEqual([]);
});

it("PATCH accepted by the server but not acknowledged replays set-field edits idempotently after timeout", async () => {
  jest.useFakeTimers();
  try {
    const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/patch-timeout", captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
    const bookmark = { id: "accepted", userId: "reader", userNote: null, laterUntil: null } as any;
    const create = jest.fn(async () => {
      await saveQueue.confirm(entry.id, { note: "Exactly once text", laterUntil: null }, "reader");
      return { bookmark: { ...bookmark } };
    });
    let started!: () => void;
    const patchStarted = new Promise<void>(resolve => { started = resolve; });
    const update = jest.fn(async (_id: string, fields: any) => {
      Object.assign(bookmark, fields);
      if (update.mock.calls.length === 1) { started(); return new Promise<any>(() => {}); }
      return { ...bookmark };
    });
    const first = saveQueue.drain("reader", { create, update });
    await patchStarted;
    await jest.advanceTimersByTimeAsync(8000);
    await first;
    expect(await saveQueue.list()).toEqual([expect.objectContaining({ note: "Exactly once text", failure: "retry" })]);
    await saveQueue.drain("reader", { create, update });
    expect(bookmark.userNote).toBe("Exactly once text");
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(await saveQueue.list()).toEqual([]);
  } finally { jest.useRealTimers(); }
});

it("a duplicate create preserves stored note precedence and changes only later confirmation fields", async () => {
  const later = new Date(Date.now() + 3600000);
  const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/duplicate", userNote: "New save note", laterUntil: later, captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
  const bookmark = { id: "existing", userId: "reader", userNote: "Stored private note", laterUntil: later.toISOString() } as any;
  const update = jest.fn(async (_id: string, fields: any) => ({ ...bookmark, ...fields }));
  await saveQueue.drain("reader", { create: async () => ({ bookmark, alreadySaved: true }), update });
  expect(update).not.toHaveBeenCalled();
  const next = await saveQueue.enqueue({ sourceUrl: entry.url, userNote: "New save note", laterUntil: later, captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
  await saveQueue.drain("reader", { create: async () => {
    await saveQueue.confirm(next.id, { note: "New save note", laterUntil: null }, "reader");
    return { bookmark, alreadySaved: true };
  }, update });
  expect(update).toHaveBeenCalledWith("existing", { laterUntil: null }, expect.anything(), "reader");
  expect(await saveQueue.list()).toEqual([]);
});

it("expired Later during a held create reconciles to an explicit clear without dropping the note", async () => {
  jest.useFakeTimers();
  try {
    const time = new Date();
    const later = new Date(time.getTime() + 1000);
    const entry = await saveQueue.enqueue({ sourceUrl: "https://example.com/expires", userNote: "Keep note", laterUntil: later, captureSource: "save_sheet", capturePlatform: "ios" }, "reader");
    const update = jest.fn(async () => ({ id: "accepted", userId: "reader" } as any));
    await saveQueue.drain("reader", { create: async () => {
      jest.setSystemTime(time.getTime() + 2000);
      return { bookmark: { id: "accepted", userId: "reader" } as any };
    }, update });
    expect(update).toHaveBeenCalledWith("accepted", { laterUntil: null }, expect.anything(), "reader");
    expect(await saveQueue.list()).toEqual([]);
    expect(entry.note).toBe("Keep note");
  } finally { jest.useRealTimers(); }
});
