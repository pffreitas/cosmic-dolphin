import { createBridge } from "./bridge";
import { loadConfig, NATIVE_BODY_PARSER_LIMIT_BYTES } from "./config";

export function start() {
  const config = loadConfig(process.env);
  const bridge = createBridge(config);
  const server = Bun.serve({
    port: config.port,
    hostname: "0.0.0.0",
    maxRequestBodySize: NATIVE_BODY_PARSER_LIMIT_BYTES,
    idleTimeout: 30,
    fetch: bridge.handle,
    error: () => Response.json({ error: "internal_error" }, { status: 500 }),
  });
  const beat = async () => {
    if (!(await bridge.heartbeat()).ok) console.error('{"event":"log_bridge_heartbeat_failed"}');
  };
  void beat();
  const interval = setInterval(() => { void beat(); }, config.limits.heartbeatIntervalMs);
  const stop = () => { clearInterval(interval); void server.stop(); };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  console.log('{"event":"log_bridge_started"}');
  return { server, stop };
}

if (import.meta.main) {
  try { start(); } catch { console.error('{"event":"log_bridge_start_failed"}'); process.exitCode = 1; }
}
