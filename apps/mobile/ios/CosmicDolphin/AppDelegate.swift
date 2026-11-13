import Expo
import os
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  // SDK54 modules still read the application delegate's window. The scene owns it.
  var window: UIWindow?
  private var applicationLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let probe = Logger(subsystem: "com.cosmicdolphin.share-key", category: "native-probe")
    if let group = Bundle.main.object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String {
      do {
        let readable = try SharedKeychain(accessGroup: group).read() != nil
        probe.notice("App target shared key readable=\(readable, privacy: .public)")
      } catch { probe.error("App target shared key read failed") }
    }
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)
    applicationLaunchOptions = launchOptions

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func startReactNative(in window: UIWindow, connectionOptions: UIScene.ConnectionOptions) {
    guard let factory = reactNativeFactory else { return }
    self.window = window
    let application = UIApplication.shared
    let context = connectionOptions.urlContexts.first
    let activity = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb })
      ?? connectionOptions.userActivities.first
    let launchOptions = SceneLaunchOptions.make(
      applicationOptions: applicationLaunchOptions,
      url: context?.url,
      sourceApplication: context?.options.sourceApplication,
      annotation: context?.options.annotation,
      userActivity: activity
    )
    // Seed Expo Linking before JS reads its initial URL. RN gets the same intent
    // through launchOptions; do not also emit a warm RN event for this cold link.
    if let context {
      _ = super.application(application, open: context.url, options: SceneLaunchOptions.urlOptions(
        sourceApplication: context.options.sourceApplication,
        annotation: context.options.annotation,
        openInPlace: context.options.openInPlace
      ))
    } else if let activity {
      _ = super.application(application, continue: activity, restorationHandler: { _ in })
    }
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    // A reconnect must use its own scene intent, not a previous launch's URL.
    applicationLaunchOptions = nil
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene, let appDelegate else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.startReactNative(in: window, connectionOptions: connectionOptions)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate else { return }
    let application = UIApplication.shared
    for context in URLContexts {
      _ = appDelegate.application(application, open: context.url, options: SceneLaunchOptions.urlOptions(
        sourceApplication: context.options.sourceApplication,
        annotation: context.options.annotation,
        openInPlace: context.options.openInPlace
      ))
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  // Expo54 subscribers implement app-delegate rather than scene callbacks.
  // UIKit continues to publish application notifications consumed by RN AppState.
  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    if appDelegate?.window === window {
      appDelegate?.window = nil
    }
    window = nil
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
