import { describe, test, expect } from "bun:test";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const scriptPath = path.join(__dirname, "verify-config-security.ts");
const apiRoot = path.join(__dirname, "../..");

describe("Config Security", () => {
  test("should load successfully in development without JWT_SECRET", async () => {
    try {
      await execAsync(`bun ${scriptPath}`, {
        cwd: apiRoot,
        env: { ...process.env, NODE_ENV: "development", JWT_SECRET: "" },
      });
    } catch (e) {
        throw new Error("Should not have failed in development");
    }
  });

  test("should load successfully in production WITH JWT_SECRET", async () => {
    try {
      await execAsync(`bun ${scriptPath}`, {
        cwd: apiRoot,
        env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "proper-secret" },
      });
    } catch (e: any) {
      console.error("Test 2 failed with:", e.stderr || e.message);
      throw new Error("Should not have failed in production with secret");
    }
  });

  test("should FAIL in production WITHOUT JWT_SECRET", async () => {
    try {
      await execAsync(`bun ${scriptPath}`, {
        cwd: apiRoot,
        env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "" },
      });
      console.log("Test 3 passed unexpectedly (script exited 0)");
      throw new Error("Should have failed");
    } catch (error: any) {
      if (error.message === "Should have failed") throw error;

      expect(error).toBeDefined();
      expect(error.code).not.toBe(0);
    }
  });
});
