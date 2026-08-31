import "reflect-metadata";
import { describe, expect, test } from "bun:test";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

describe("worker framework compatibility", () => {
  test("boots a Nest application context with scheduling enabled", async () => {
    class SchedulerSmokeTestModule {}
    Module({ imports: [ScheduleModule.forRoot()] })(SchedulerSmokeTestModule);

    const app = await NestFactory.createApplicationContext(
      SchedulerSmokeTestModule,
      { abortOnError: false, logger: false },
    );

    expect(app).toBeDefined();
    await app.close();
  });
});
