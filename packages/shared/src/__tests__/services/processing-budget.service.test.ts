import { describe, it, expect, jest } from "@jest/globals";
import {
  ProcessingBudgetServiceImpl,
  startOfUtcDay,
} from "../../services/processing-budget.service";
import { BookmarkProcessingRepository } from "../../repositories/bookmark-processing.repository";

function repositoryReturning(count: number) {
  return {
    countRunsSince: jest.fn(async () => count),
  } as unknown as jest.Mocked<BookmarkProcessingRepository>;
}

describe("ProcessingBudgetService", () => {
  const now = new Date("2026-08-27T15:42:00.000Z");

  it("counts only runs started in the current UTC day", async () => {
    const repository = repositoryReturning(3);
    const service = new ProcessingBudgetServiceImpl(repository, 10, () => now);

    const decision = await service.check("user-1");

    expect(repository.countRunsSince).toHaveBeenCalledWith(
      "user-1",
      startOfUtcDay(now)
    );
    expect(decision).toEqual({
      withinBudget: true,
      used: 3,
      limit: 10,
      resetsAt: new Date("2026-08-28T00:00:00.000Z"),
    });
  });

  it("refuses once the limit is reached, not after it is passed", async () => {
    const service = new ProcessingBudgetServiceImpl(
      repositoryReturning(10),
      10,
      () => now
    );

    await expect(service.check("user-1")).resolves.toMatchObject({
      withinBudget: false,
      used: 10,
    });
  });

  it("treats a zero budget as processing being off, never as unlimited", async () => {
    const repository = repositoryReturning(0);
    const service = new ProcessingBudgetServiceImpl(repository, 0, () => now);

    await expect(service.check("user-1")).resolves.toMatchObject({
      withinBudget: false,
    });
    // No point asking the database what a disabled pipeline has spent.
    expect(repository.countRunsSince).not.toHaveBeenCalled();
  });
});
