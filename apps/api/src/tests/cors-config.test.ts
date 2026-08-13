import { describe, expect, it } from "bun:test";
import path from "node:path";
import {
  getAllowedFrontendOrigins,
  resolveFrontendOrigin,
} from "../config/environment";

function repoPath(relativePath: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(path.join("apps", "api"))
    ? path.resolve(cwd, "../..")
    : cwd;

  return path.join(root, relativePath);
}

describe("CORS frontend origin config", () => {
  it("parses comma-separated production frontend origins", () => {
    expect(
      getAllowedFrontendOrigins(
        "https://cosmic-dolphin.com, https://www.cosmic-dolphin.com"
      )
    ).toEqual([
      "https://cosmic-dolphin.com",
      "https://www.cosmic-dolphin.com",
    ]);
  });

  it("falls back to the local web origin when no frontend origin is configured", () => {
    expect(getAllowedFrontendOrigins()).toEqual(["http://localhost:3001"]);
  });

  it("resolves the request origin only when it is allowed", () => {
    const allowedOrigins = [
      "https://cosmic-dolphin.com",
      "https://www.cosmic-dolphin.com",
    ];

    expect(
      resolveFrontendOrigin("https://www.cosmic-dolphin.com", allowedOrigins)
    ).toBe("https://www.cosmic-dolphin.com");
    expect(
      resolveFrontendOrigin("https://malicious.example", allowedOrigins)
    ).toBe("https://cosmic-dolphin.com");
  });

  it("configures the deployed API to allow production web origins", async () => {
    const appSpec = await Bun.file(repoPath(".do/api-app.yml")).text();

    expect(appSpec).toContain("key: FRONTEND_URL");
    expect(appSpec).toContain("https://cosmic-dolphin.com");
    expect(appSpec).toContain("https://www.cosmic-dolphin.com");
  });

  it("redeploys the backend when the API app spec changes", async () => {
    const workflow = await Bun.file(
      repoPath(".github/workflows/deploy-backend.yml")
    ).text();

    expect(workflow).toContain(".do/api-app.yml");
  });
});
