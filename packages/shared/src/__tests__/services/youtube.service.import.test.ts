import { spawnSync } from "node:child_process";

describe("youtube-transcript runtime import", () => {
  it("loads in the Node CommonJS runtime used by the worker", () => {
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        "const yt = require('youtube-transcript'); console.log(JSON.stringify(Object.keys(yt).sort()))",
      ],
      {
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toContain("YoutubeTranscript");
  });
});
