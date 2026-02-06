import { describe, it, expect } from "bun:test";
import { spawnSync } from "child_process";
import { join } from "path";

describe("Configuration Validation", () => {
  // Locate the script relative to this test file
  const scriptPath = join(import.meta.dir, "../config/environment.ts");

  it("should fail when DATABASE_URL is missing", () => {
    const result = spawnSync("bun", [scriptPath], {
      env: {
        ...process.env,
        DATABASE_URL: "",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "key"
      },
      encoding: "utf-8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing required environment variable: DATABASE_URL");
  });

  it("should fail when SUPABASE_URL is missing", () => {
    const result = spawnSync("bun", [scriptPath], {
      env: {
        ...process.env,
        DATABASE_URL: "postgres://localhost",
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "key"
      },
      encoding: "utf-8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing required environment variable: SUPABASE_URL");
  });

  it("should fail when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    const result = spawnSync("bun", [scriptPath], {
      env: {
        ...process.env,
        DATABASE_URL: "postgres://localhost",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: ""
      },
      encoding: "utf-8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  });

  it("should succeed when all critical env vars are present", () => {
    const result = spawnSync("bun", [scriptPath], {
      env: {
        ...process.env,
        DATABASE_URL: "postgres://user:pass@localhost:5432/db",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret-key",
      },
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});
