import { describe, expect, test } from "bun:test";
import { configureApp } from "./app.setup";

describe("app setup", () => {
  test("app setup enables shutdown hooks", () => {
    let enabled = 0;
    const app = {
      enableShutdownHooks: () => {
        enabled += 1;
      },
    };

    configureApp(app as never);

    expect(enabled).toBe(1);
  });
});
