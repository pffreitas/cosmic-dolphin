import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LightpandaPageProvider } from "../../services/lightpanda.service";

/** A stand-in browser that records each launch and then idles. */
describe("LightpandaPageProvider cancellation", () => {
  let dir: string;
  let marker: string;
  let provider: LightpandaPageProvider;

  const launches = () =>
    existsSync(marker) ? readFileSync(marker, "utf8").split("\n").filter(Boolean).length : 0;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lightpanda-test-"));
    marker = join(dir, "launches");
    const binary = join(dir, "fake-lightpanda");
    writeFileSync(binary, `#!/bin/sh\necho launch >> "${marker}"\nexec sleep 30\n`);
    chmodSync(binary, 0o755);
    provider = new LightpandaPageProvider(binary);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("a signal that is already aborted never launches a browser", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.extract("https://example.com/", { signal: controller.signal })
    ).rejects.toMatchObject({ shouldRetry: true });
    await sleep(300);
    expect(launches()).toBe(0);
  });

  it("cancelling while queued behind another extraction ends at once without launching", async () => {
    const first = new AbortController();
    const holding = provider
      .extract("https://example.com/a", { signal: first.signal })
      .catch((error: unknown) => error);
    await sleep(300);
    expect(launches()).toBe(1);

    const second = new AbortController();
    const queued = provider
      .extract("https://example.com/b", { signal: second.signal })
      .then(() => "resolved", (error: unknown) => error);
    await sleep(50);
    second.abort();

    const outcome = await Promise.race([queued, sleep(1000).then(() => "still waiting")]);
    expect(outcome).not.toBe("still waiting");
    expect(outcome).toMatchObject({ shouldRetry: true });
    expect(launches()).toBe(1);

    // The slot is intact for whoever is next.
    first.abort();
    await holding;
  });
});
