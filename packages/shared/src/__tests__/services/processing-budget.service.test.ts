import { describe, it, expect, afterEach } from "@jest/globals";
import {
  DEFAULT_DAILY_PROCESSING_BUDGET,
  dailyProcessingBudget,
  startOfUtcDay,
} from "../../services/processing-budget.service";

describe("processing budget", () => {
  const original = process.env.PROCESSING_BUDGET_DAILY;
  afterEach(() => {
    if (original === undefined) delete process.env.PROCESSING_BUDGET_DAILY;
    else process.env.PROCESSING_BUDGET_DAILY = original;
  });

  it("counts bookmarks created in the current UTC day", () => {
    expect(startOfUtcDay(new Date("2026-08-27T15:42:00.000Z"))).toEqual(
      new Date("2026-08-27T00:00:00.000Z")
    );
    expect(startOfUtcDay(new Date("2026-08-27T23:59:59.999Z"))).toEqual(
      new Date("2026-08-27T00:00:00.000Z")
    );
  });

  it("defaults the limit and lets the environment override it, zero included", () => {
    delete process.env.PROCESSING_BUDGET_DAILY;
    expect(dailyProcessingBudget()).toBe(DEFAULT_DAILY_PROCESSING_BUDGET);
    process.env.PROCESSING_BUDGET_DAILY = "7";
    expect(dailyProcessingBudget()).toBe(7);
    process.env.PROCESSING_BUDGET_DAILY = "0";
    expect(dailyProcessingBudget()).toBe(0);
    process.env.PROCESSING_BUDGET_DAILY = "junk";
    expect(dailyProcessingBudget()).toBe(DEFAULT_DAILY_PROCESSING_BUDGET);
  });
});
