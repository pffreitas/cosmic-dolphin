import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveQueue } from "../save-queue";
import type { PendingShare, ShareQueueReader } from "../../modules/share-queue";
jest.mock("expo-crypto", () => ({ randomUUID: () => require("crypto").randomUUID() }));
const entry: PendingShare = { id: "stable-ios-id", url: "https://example.com/queued", userId: "reader", queuedAt: "2026-11-09T12:00:00.123Z", notBefore: "2026-11-11T12:00:00Z" };
beforeEach(async () => { await AsyncStorage.clear(); jest.restoreAllMocks(); });
function bridgeFor(entries: PendingShare[]) {
  return { readPendingShares: jest.fn(async () => JSON.stringify(entries)),
    removePendingShares: jest.fn(async (_ids: string[]) => {}) } satisfies ShareQueueReader;
}
it("durably imports the native stable ID and original times before removing only that snapshot", async () => {
  const bridge = bridgeFor([entry]);
  // The bridge runs inside the serialized mutation lane: inspect the durable storage directly.
  bridge.removePendingShares.mockImplementation(async ids => {
    expect(JSON.parse((await AsyncStorage.getItem("save-queue:v1"))!)).toEqual([expect.objectContaining({ ...entry, captureSource: "ios_share_extension", capturePlatform: "ios", attempts: 0 })]);
    expect(ids).toEqual([entry.id]);
  });
  expect(await saveQueue.importShares(bridge)).toEqual([entry.id]);
  expect(await saveQueue.importShares(bridge)).toEqual([entry.id]);
  expect(await saveQueue.list()).toHaveLength(1);
  expect(bridge.removePendingShares).toHaveBeenCalledTimes(2);
});
it("keeps an imported revoked-key owner's save isolated until matching-account replay", async () => {
  const owned = { ...entry, notBefore: undefined };
  await saveQueue.importShares(bridgeFor([owned]));
  const create = jest.fn(async () => ({ bookmark: { id: "accepted", userId: "reader" } as any, alreadySaved: true }));
  await saveQueue.drain("other", { create });
  expect(create).not.toHaveBeenCalled();
  expect(await saveQueue.list()).toEqual([expect.objectContaining({ userId: "reader", id: entry.id })]);
  await saveQueue.drain("reader", { create });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: entry.url, captureSource: "ios_share_extension", capturePlatform: "ios", queuedAt: new Date(entry.queuedAt) }), expect.anything(), "reader");
  expect(await saveQueue.list()).toEqual([]);
});
it("leaves the native snapshot untouched when app persistence is interrupted", async () => {
  const bridge = bridgeFor([entry]);
  const write = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("Process killed before app persistence"));
  await expect(saveQueue.importShares(bridge)).rejects.toThrow("Process killed");
  expect(bridge.removePendingShares).not.toHaveBeenCalled();
  expect(await saveQueue.list()).toEqual([]);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(write);
  await saveQueue.importShares(bridge);
  expect(await saveQueue.list()).toHaveLength(1);
});
it("replays a crash after app import or server accept without losing a concurrent native arrival", async () => {
  const imported = { ...entry, notBefore: undefined };
  const arrival = { ...entry, id: "arrived-during-import", url: "https://example.com/arrival", notBefore: undefined };
  let native = [imported];
  const bridge = bridgeFor(native);
  bridge.readPendingShares.mockImplementation(async () => JSON.stringify(native));
  bridge.removePendingShares.mockImplementationOnce(async () => {
    native.push(arrival);
    throw new Error("Process killed after app persistence before native removal");
  }).mockImplementation(async ids => { native = native.filter(value => !ids.includes(value.id)); });
  await expect(saveQueue.importShares(bridge)).rejects.toThrow("Process killed");
  expect((await saveQueue.list()).map(value => value.id)).toEqual([entry.id]);
  await saveQueue.importShares(bridge);
  expect(native).toEqual([]);
  expect((await saveQueue.list()).map(value => value.id)).toEqual([entry.id, arrival.id]);
  const bookmarks = new Set<string>();
  const create = jest.fn(async (request: any) => {
    const alreadySaved = bookmarks.has(request.sourceUrl); bookmarks.add(request.sourceUrl);
    if (create.mock.calls.length === 1) (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("Killed after server acceptance"));
    return { bookmark: { id: request.sourceUrl, userId: "reader" } as any, alreadySaved };
  });
  await saveQueue.drain("reader", { create });
  expect((await saveQueue.list()).map(value => value.id)).toEqual([entry.id]);
  const accepted = jest.fn();
  await saveQueue.drain("reader", { create }, { onStatus: accepted });
  expect(bookmarks.size).toBe(2);
  expect(accepted).toHaveBeenCalledWith(expect.objectContaining({ id: entry.id, queuedAt: entry.queuedAt }), "saved", expect.anything(), true);
  expect(await saveQueue.list()).toEqual([]);
});
