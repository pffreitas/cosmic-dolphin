FROM oven/bun:1.3.11-alpine
WORKDIR /app
COPY --chown=bun:bun scripts/log-forwarding/config.ts scripts/log-forwarding/normalize.ts scripts/log-forwarding/bridge.ts scripts/log-forwarding/main.ts ./
USER bun
EXPOSE 8080
CMD ["bun", "run", "main.ts"]
