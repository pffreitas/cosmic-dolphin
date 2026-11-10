import { MobileAPI } from "../mobile-api";
import { cacheBookmarksInBackground } from "../bookmark-cache";
const mockSession = { access_token: "fixture-jwt", user: { id: "reader" } };
jest.mock("../supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: mockSession } }) } } }));
jest.mock("../bookmark-cache", () => ({ cacheBookmarksInBackground: jest.fn() }));
it("a JWT create response for another owner is rejected before it enters the native bookmark cache", async () => {
  global.fetch = jest.fn(async () => new Response(JSON.stringify({ bookmark: {
    id: "other-save", userId: "other", sourceUrl: "https://example.com/owned",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), processingStatus: "processing",
  } }), { status: 201, headers: { "Content-Type": "application/json" } })) as any;
  await expect(MobileAPI.create({ sourceUrl: "https://example.com/owned", captureSource: "save_sheet", capturePlatform: "ios" }, undefined, "reader"))
    .rejects.toMatchObject({ response: { status: 401 } });
  expect(cacheBookmarksInBackground).not.toHaveBeenCalled();
});
