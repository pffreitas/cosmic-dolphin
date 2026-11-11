import fs from "node:fs";
import path from "node:path";
it("keeps iOS share-intent generation disabled and the maintained Swift extension in the native project", () => {
  const root = path.resolve(__dirname, "../..");
  const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
  const plugin = app.expo.plugins.find((value: unknown) => Array.isArray(value) && value[0] === "expo-share-intent");
  expect(plugin[1].disableIOS).toBe(true);
  expect(fs.existsSync(path.join(root, "ios/ShareExtension/ShareViewController.swift"))).toBe(true);
  const project = fs.readFileSync(path.join(root, "ios/CosmicDolphin.xcodeproj/project.pbxproj"), "utf8");
  for (const source of ["ShareViewController.swift", "PendingShares.swift", "ShareCapture.swift"]) expect(project).toContain(source + " in Sources");
});
