import fs from "node:fs";
import path from "node:path";

it("applies the post-splash theme before forcing Android window decor", () => {
  const root = path.resolve(__dirname, "../..");
  const activity = fs.readFileSync(path.join(root, "android/app/src/main/java/com/cosmicdolphin/app/MainActivity.kt"), "utf8");
  const source = activity.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  const onCreate = source.match(/override fun onCreate\(savedInstanceState: Bundle\?\)\s*\{([^}]+)\}/)?.[1];

  // Source contract only: native cold-launch proof verifies actual visibility.
  // configureSplashSystemBars touches decorView, so Expo must switch themes first.
  expect(onCreate).toBeDefined();
  expect(onCreate?.match(/\S[^\n]*/g)?.map(line => line.trim())).toEqual([
    "SplashScreenManager.registerOnActivity(this)",
    "configureSplashSystemBars()",
    "super.onCreate(null)",
    "showFullScreenSplashOverlay()",
  ]);
});
