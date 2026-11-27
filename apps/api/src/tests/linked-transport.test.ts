/** Real Got transport on loopback: the follow guard runs before every dispatch, redirect and retry (§8.7, NFR-5). */
import { afterAll, beforeAll, beforeEach, expect, it, spyOn } from "bun:test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { CosmicHttpClient, RejectedHostError, assertFollowableUrl } from "@cosmic-dolphin/shared";

let server: Server;
let origin: string;
let port: number;
const hits: string[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    hits.push(`${request.headers.host?.split(":")[0]}${request.url}`);
    if (request.url === "/start") {
      response.writeHead(302, { Location: `http://localhost:${port}/secret` });
      response.end();
    } else if (request.url === "/flaky") {
      response.writeHead(503, { "Retry-After": "0" });
      response.end("busy");
    } else {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("<p>ok</p>");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  origin = `http://127.0.0.1:${port}`;
});
afterAll(() => server.close());
beforeEach(() => {
  hits.length = 0;
});

/** Admits the loopback test server by address and refuses the `localhost` name. */
const refuseLocalhostName = (calls: string[]) => (url: URL) => {
  calls.push(url.href);
  if (url.hostname === "localhost") throw new RejectedHostError(url.href);
};

it("rejects a loopback destination before anything is sent", async () => {
  await expect(new CosmicHttpClient().fetch(`${origin}/page`, { guard: assertFollowableUrl, quiet: true })).rejects.toBeInstanceOf(RejectedHostError);
  expect(hits).toEqual([]);
});

it("refuses a redirect to a rejected host before following it", async () => {
  const calls: string[] = [];
  await expect(new CosmicHttpClient().fetch(`${origin}/start`, { guard: refuseLocalhostName(calls), retryLimit: 0, quiet: true })).rejects.toBeInstanceOf(RejectedHostError);
  expect(hits).toEqual(["127.0.0.1/start"]);
  expect(calls).toContain(`http://localhost:${port}/secret`);
});

it("checks the guard again before a retry is dispatched", async () => {
  await expect(new CosmicHttpClient().fetch(`${origin}/flaky`, { guard: () => undefined, retryLimit: 1, quiet: true })).rejects.toMatchObject({ status: 503 });
  expect(hits).toEqual(["127.0.0.1/flaky", "127.0.0.1/flaky"]);

  hits.length = 0;
  // Admit only what is sent before the server has seen a request: the retry must be refused.
  const guard = (url: URL) => {
    if (hits.length > 0) throw new RejectedHostError(url.href);
  };
  await expect(new CosmicHttpClient().fetch(`${origin}/flaky`, { guard, retryLimit: 1, quiet: true })).rejects.toBeInstanceOf(RejectedHostError);
  expect(hits).toEqual(["127.0.0.1/flaky"]);
});

it("keeps follow URLs out of the request logs", async () => {
  const log = spyOn(console, "log").mockImplementation(() => undefined);
  try {
    const response = await new CosmicHttpClient().fetch(`${origin}/page`, { guard: refuseLocalhostName([]), quiet: true });
    expect(response.ok).toBe(true);
    expect(log).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});
