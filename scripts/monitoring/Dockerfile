FROM oven/bun:1.3.11-alpine
WORKDIR /monitor
COPY scripts/monitoring/ /monitor/scripts/monitoring/
COPY .do/monitoring-app.yml /monitor/.do/monitoring-app.yml
USER bun
ENTRYPOINT ["bun", "--no-env-file", "scripts/monitoring/monitor.ts"]
CMD ["--publish"]
