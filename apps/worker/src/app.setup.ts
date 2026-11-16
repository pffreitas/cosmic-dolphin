import type { INestApplication } from "@nestjs/common";

/**
 * Setup applied to the worker app before it listens. Shutdown hooks are what
 * make SIGTERM run `QueueProcessor.onModuleDestroy`, so a deploy stops the
 * worker after in-flight work instead of killing it mid-message.
 */
export function configureApp(app: INestApplication): void {
  app.enableShutdownHooks();
}
