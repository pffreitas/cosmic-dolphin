import { MobileAPI } from "../mobile-api";
jest.mock("../supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "fictional-test-token", user: { id: "reader" } } } }) } } }));
jest.mock("../bookmark-cache", () => ({ cacheBookmarksInBackground: jest.fn() }));
it("uses the native IANA zone and retries only a rejected zone once in UTC through the generated client", async () => {
  const original = global.fetch;
  const fetcher = jest.fn().mockResolvedValueOnce(new Response('{"error":"Unknown time zone"}', { status: 400 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ localDate: "2026-11-11", refreshesAt: "2026-11-12T06:00:00Z", items: [] }), { status: 200 }));
  global.fetch = Object.assign(fetcher, { preconnect: original.preconnect });
  try {
    const response = await MobileAPI.picks();
    expect(new URL(fetcher.mock.calls[0][0], "https://fixture.invalid").searchParams.get("tz")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(new URL(fetcher.mock.calls[1][0], "https://fixture.invalid").searchParams.get("tz")).toBe("UTC");
    expect(response.localDate).toBe("2026-11-11");
    expect(response.refreshesAt).toBeInstanceOf(Date);
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockClear().mockResolvedValue(new Response('{}', { status: 500 }));
    await expect(MobileAPI.picks()).rejects.toMatchObject({ response: { status: 500 } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { global.fetch = original; }
});
it("requests exactly fifteen For-you items and keeps cursor-based Following and Unread paging", async () => {
  const original = global.fetch;
  const fetcher = jest.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response('{"items":[]}', { status: 200 }));
  global.fetch = Object.assign(fetcher, { preconnect: original.preconnect });
  try {
    await MobileAPI.feed("for_you"); await MobileAPI.feed("following", "opaque"); await MobileAPI.feed("unread");
    const queries = fetcher.mock.calls.map(call => new URL(call[0] as string, "https://fixture.invalid").searchParams);
    expect(queries.map(query => query.get("limit"))).toEqual(["15", "30", "30"]);
    expect(queries.map(query => query.get("scope"))).toEqual(["for_you", "following", "unread"]);
    expect(queries[1].get("cursor")).toBe("opaque");
  } finally { global.fetch = original; }
});
