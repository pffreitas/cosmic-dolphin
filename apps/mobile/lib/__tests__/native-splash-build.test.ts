import fs from "node:fs";
import path from "node:path";

it("registers the Android platform splash before React creates the launch view", () => {
  const root = path.resolve(__dirname, "../..");
  const activity = fs.readFileSync(path.join(root, "android/app/src/main/java/com/cosmicdolphin/app/MainActivity.kt"), "utf8");
  const source = activity.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  const onCreate = source.match(/override fun onCreate\(savedInstanceState: Bundle\?\)\s*\{([^}]+)\}/)?.[1];

  // Expo owns the native splash until the React launch view has laid out.
  expect(onCreate).toBeDefined();
  expect(onCreate?.match(/\S[^\n]*/g)?.map(line => line.trim())).toEqual([
    "SplashScreenManager.registerOnActivity(this)",
    "super.onCreate(null)",
  ]);
});
