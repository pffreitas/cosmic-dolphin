import { execFileSync } from "node:child_process";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const browserVersion = execFileSync(
    process.env.LIGHTPANDA_BINARY_PATH || "lightpanda",
    ["version"],
    { encoding: "utf8", timeout: 5_000 },
  ).trim();
  console.log(`Lightpanda browser ready (${browserVersion})`);
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get("WORKER_PORT", 3002);

  await app.listen(port);
  console.log(`Worker application is running on: ${await app.getUrl()}`);
}
bootstrap();
