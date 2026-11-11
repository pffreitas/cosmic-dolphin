import { ShareKeyManager, type SharedShareKey } from "../share-key";
let item: SharedShareKey | null;
const storage = {
  read: jest.fn(async () => item),
  write: jest.fn(async (value: SharedShareKey) => { item = value; }),
  remove: jest.fn(async () => { item = null; }),
  deviceId: jest.fn(async () => "stable-installation"),
};
const api = { issue: jest.fn(async () => ({ id: "key-1", key: `cdsk_${"a".repeat(43)}` })), revoke: jest.fn(async () => {}) };
let manager: ShareKeyManager;
beforeEach(() => {
  jest.clearAllMocks(); item = null;
  manager = new ShareKeyManager({ storage, api, apiBaseUrl: "https://fixture.example" });
});
it("issues the missing installation key and writes exactly the native payload on sign-in", async () => {
  await manager.ensure("reader");
  expect(item).toEqual({ key: `cdsk_${"a".repeat(43)}`, keyId: "key-1", deviceId: "stable-installation", userId: "reader", apiBaseUrl: "https://fixture.example" });
  expect(api.issue).toHaveBeenCalledWith("stable-installation", "reader");
});
it("keeps an existing key on foreground and replaces it only when missing", async () => {
  await manager.ensure("reader");
  const first = item;
  await manager.ensure("reader");
  expect(item).toBe(first);
  expect(api.issue).toHaveBeenCalledTimes(1);
  item = null;
  await manager.ensure("reader");
  expect(api.issue).toHaveBeenCalledTimes(2);
});
it("acquires a missing device key and waits for its revoke acknowledgement before clearing sign-in", async () => {
  let acknowledge!: () => void;
  api.revoke.mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }));
  const finish = jest.fn(async () => {});
  const signingOut = manager.signOut("reader", finish);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(api.revoke).toHaveBeenCalledWith("key-1", "reader");
  expect(item?.keyId).toBe("key-1");
  expect(finish).not.toHaveBeenCalled();
  acknowledge(); await signingOut;
  expect(finish).toHaveBeenCalledTimes(1);
  expect(item).toBeNull();
});
it("serializes late issuance and foreground with sign-out so no key is recreated", async () => {
  let issue!: (value: { id: string; key: string }) => void;
  api.issue.mockImplementationOnce(() => new Promise(resolve => { issue = resolve; }));
  const issuing = manager.ensure("reader");
  await new Promise(resolve => setTimeout(resolve, 0));
  const finish = jest.fn(async () => {});
  const signingOut = manager.signOut("reader", finish);
  const foreground = manager.ensure("reader");
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(api.issue).toHaveBeenCalledTimes(1);
  expect(finish).not.toHaveBeenCalled();
  issue({ id: "late-key", key: `cdsk_${"b".repeat(43)}` });
  await Promise.all([issuing, signingOut, foreground]);
  expect(api.revoke).toHaveBeenCalledWith("late-key", "reader");
  expect(item).toBeNull();
  expect(api.issue).toHaveBeenCalledTimes(1);
});
it("retains credential and session after failed revoke and allows an idempotent retry", async () => {
  await manager.ensure("reader");
  const original = item;
  api.revoke.mockRejectedValueOnce(new Error("offline"));
  const finish = jest.fn(async () => {});
  await expect(manager.signOut("reader", finish)).rejects.toThrow("offline");
  expect(item).toBe(original);
  expect(finish).not.toHaveBeenCalled();
  await manager.signOut("reader", finish);
  expect(api.revoke).toHaveBeenNthCalledWith(2, "key-1", "reader");
  expect(finish).toHaveBeenCalledTimes(1);
  expect(item).toBeNull();
  await manager.ensure("reader");
  expect(item).toBeNull();
});
