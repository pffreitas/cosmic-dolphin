import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ios = path.resolve(__dirname, "../../ios");
const delegate = fs.readFileSync(path.join(ios, "CosmicDolphin/AppDelegate.swift"), "utf8");
const plist = JSON.parse(execFileSync("python3", ["-c", "import plistlib,json,sys; print(json.dumps(plistlib.load(open(sys.argv[1], 'rb'))))", path.join(ios, "CosmicDolphin/Info.plist")], { encoding: "utf8" }));

// Native configuration/source contracts only. Actual Release launch and link
// delivery must also be exercised on iOS; this cannot simulate UIKit's trap.
it("configures a single scene with a concrete window-scene delegate", () => {
  expect(plist.UIApplicationSceneManifest).toEqual({
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [{
        UISceneConfigurationName: "Default Configuration",
        UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
      }],
    },
  });
  expect(delegate).toContain("class SceneDelegate: UIResponder, UIWindowSceneDelegate");
  expect(delegate).toContain("UIWindow(windowScene: windowScene)");
  expect(delegate).not.toContain("UIWindow(frame: UIScreen.main.bounds)");
});

it("starts React Native only after scene connection and registers cold links first", () => {
  const didFinish = delegate.slice(delegate.indexOf("didFinishLaunchingWithOptions"), delegate.indexOf("func startReactNative"));
  expect(didFinish).not.toContain("factory.startReactNative(");
  expect(delegate).toContain("SceneLaunchOptions.make(");
  expect(delegate).toContain("super.application(application, open:");
  expect(delegate).toContain("super.application(application, continue:");
  expect(delegate.indexOf("SceneLaunchOptions.make(")).toBeLessThan(delegate.indexOf("factory.startReactNative("));
  expect(delegate).toContain("appDelegate.startReactNative(in: window, connectionOptions: connectionOptions)");
  expect(delegate).toContain("sceneRootHost.connect(to: window, start:");
  expect(delegate).toContain("self.startInitialReactNative(in: window, connectionOptions: connectionOptions)");
  expect(delegate).toContain("appDelegate?.disconnectScene(from: window)");
  expect(delegate).toContain("self.application(application, open:");
  expect(delegate).toContain("self.application(application, continue:");
});

it("forwards warm scene links and Expo lifecycle callbacks without replacing app handlers", () => {
  expect(delegate).toContain("openURLContexts URLContexts:");
  expect(delegate).toContain("continue userActivity: NSUserActivity");
  expect(delegate).toContain("appDelegate.application(application, open:");
  expect(delegate).toContain("appDelegate.application(UIApplication.shared, continue:");
  for (const event of ["applicationDidBecomeActive", "applicationWillResignActive", "applicationDidEnterBackground", "applicationWillEnterForeground"]) {
    expect(delegate).toContain(`appDelegate?.${event}(UIApplication.shared)`);
  }
  expect(delegate).toContain("RCTLinkingManager.application(app, open: url, options: options)");
  expect(delegate).toContain("RCTLinkingManager.application(application, continue: userActivity");
});
